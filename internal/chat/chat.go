package chat

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"swarmvault-native/internal/utils"
)

const DefaultHistoryTurns = 6

func timestampIdPrefix(now time.Time) string {
	return now.UTC().Format("20060102-150405Z")
}

func getVaultPaths(rootDir string) (stateDir, wikiDir string) {
	// We read config to get workspace paths. If not found, use defaults.
	configPath := filepath.Join(rootDir, "swarmvault.config.json")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		configPath = filepath.Join(rootDir, "swarmvault.json")
	}

	stateName := "state"
	wikiName := "wiki"

	if data, err := os.ReadFile(configPath); err == nil {
		var config struct {
			Workspace struct {
				StateDir string `json:"stateDir"`
				WikiDir  string `json:"wikiDir"`
			} `json:"workspace"`
		}
		if err := json.Unmarshal(data, &config); err == nil {
			if config.Workspace.StateDir != "" {
				stateName = config.Workspace.StateDir
			}
			if config.Workspace.WikiDir != "" {
				wikiName = config.Workspace.WikiDir
			}
		}
	}

	stateBase := filepath.Join(rootDir, stateName)
	if filepath.IsAbs(stateName) {
		stateBase = stateName
	}
	wikiBase := filepath.Join(rootDir, wikiName)
	if filepath.IsAbs(wikiName) {
		wikiBase = wikiName
	}

	stateDir = filepath.Join(stateBase, "chat-sessions")
	wikiDir = filepath.Join(wikiBase, "outputs", "chat-sessions")
	return stateDir, wikiDir
}

func sessionStatePath(stateDir, id string) string {
	return filepath.Join(stateDir, fmt.Sprintf("%s.json", id))
}

func sessionMarkdownPath(wikiDir, id string) string {
	return filepath.Join(wikiDir, fmt.Sprintf("%s.md", id))
}

func summarizeSession(session VaultChatSession) VaultChatSessionSummary {
	return VaultChatSessionSummary{
		ID:           session.ID,
		Title:        session.Title,
		CreatedAt:    session.CreatedAt,
		UpdatedAt:    session.UpdatedAt,
		TurnCount:    len(session.Turns),
		MarkdownPath: session.MarkdownPath,
	}
}

func slugify(value string) string {
	value = strings.ToLower(value)
	re := regexp.MustCompile(`[^a-z0-9]+`)
	value = re.ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	if len(value) > 80 {
		value = value[:80]
	}
	if value == "" {
		return "item"
	}
	return value
}

func truncate(value string, maxLength int) string {
	if len(value) <= maxLength {
		return value
	}
	if maxLength < 4 {
		return value[:maxLength]
	}
	return value[:maxLength-3] + "..."
}

func renderSessionMarkdown(session VaultChatSession) string {
	var lines []string
	lines = append(lines, fmt.Sprintf("# %s", session.Title))
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("Session ID: `%s`", session.ID))
	lines = append(lines, fmt.Sprintf("Updated: %s", session.UpdatedAt))
	lines = append(lines, "")

	for i, turn := range session.Turns {
		lines = append(lines, fmt.Sprintf("## Turn %d - %s", i+1, turn.CreatedAt))
		lines = append(lines, "")
		lines = append(lines, "### Question")
		lines = append(lines, "")
		lines = append(lines, turn.Question)
		lines = append(lines, "")
		lines = append(lines, "### Answer")
		lines = append(lines, "")
		lines = append(lines, turn.Answer)
		lines = append(lines, "")
		if len(turn.Citations) > 0 {
			lines = append(lines, "### Citations")
			lines = append(lines, "")
			for _, citation := range turn.Citations {
				lines = append(lines, fmt.Sprintf("- %s", citation))
			}
		}
		if turn.SavedPath != nil && *turn.SavedPath != "" {
			lines = append(lines, "")
			lines = append(lines, fmt.Sprintf("Saved output: `%s`", *turn.SavedPath))
		}
		lines = append(lines, "")
	}

	body := strings.Join(lines, "\n")

	// safeFrontmatter formatting
	frontmatter := fmt.Sprintf(`---
session_id: %s
title: %s
created_at: %s
updated_at: %s
turn_count: %d
page_id: 'chat:%s'
freshness: fresh
node_ids: []
source_ids: []
source_hashes: {}
---
`, session.ID, session.Title, session.CreatedAt, session.UpdatedAt, len(session.Turns), session.ID)

	// matter.stringify always ends body with \n
	if !strings.HasSuffix(body, "\n") {
		body += "\n"
	}
	return frontmatter + body
}

func resolveSessionId(stateDir, idOrPrefix string) (string, error) {
	direct := sessionStatePath(stateDir, idOrPrefix)
	if _, err := os.Stat(direct); err == nil {
		return idOrPrefix, nil
	}

	entries, err := os.ReadDir(stateDir)
	if err != nil {
		return "", fmt.Errorf("Chat session not found: %s", idOrPrefix)
	}

	var matches []string
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".json") {
			id := strings.TrimSuffix(entry.Name(), ".json")
			if strings.HasPrefix(id, idOrPrefix) {
				matches = append(matches, id)
			}
		}
	}

	if len(matches) == 1 {
		return matches[0], nil
	}
	if len(matches) > 1 {
		if len(matches) > 8 {
			matches = matches[:8]
		}
		return "", fmt.Errorf("Chat session prefix \"%s\" is ambiguous: %s", idOrPrefix, strings.Join(matches, ", "))
	}
	return "", fmt.Errorf("Chat session not found: %s", idOrPrefix)
}

func loadSession(stateDir, idOrPrefix string) (VaultChatSession, error) {
	id, err := resolveSessionId(stateDir, idOrPrefix)
	if err != nil {
		return VaultChatSession{}, err
	}

	data, err := os.ReadFile(sessionStatePath(stateDir, id))
	if err != nil {
		return VaultChatSession{}, fmt.Errorf("Chat session not found: %s", id)
	}

	var session VaultChatSession
	if err := json.Unmarshal(data, &session); err != nil {
		return VaultChatSession{}, err
	}
	return session, nil
}

func persistSession(session VaultChatSession, stateDir, wikiDir string) (VaultChatSession, error) {
	if err := os.MkdirAll(stateDir, 0755); err != nil {
		return session, err
	}
	if err := os.MkdirAll(wikiDir, 0755); err != nil {
		return session, err
	}

	statePath := sessionStatePath(stateDir, session.ID)
	markdownPath := sessionMarkdownPath(wikiDir, session.ID)

	session.MarkdownPath = markdownPath

	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return session, err
	}
	if err := os.WriteFile(statePath, data, 0644); err != nil {
		return session, err
	}

	if err := os.WriteFile(markdownPath, []byte(renderSessionMarkdown(session)), 0644); err != nil {
		return session, err
	}

	return session, nil
}

func ListChatSessions(rootDir string) ([]VaultChatSessionSummary, error) {
	stateDir, _ := getVaultPaths(rootDir)

	entries, err := os.ReadDir(stateDir)
	if err != nil {
		return make([]VaultChatSessionSummary, 0), nil
	}

	var sessions []VaultChatSessionSummary
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".json") {
			data, err := os.ReadFile(filepath.Join(stateDir, entry.Name()))
			if err != nil {
				continue
			}
			var session VaultChatSession
			if err := json.Unmarshal(data, &session); err == nil {
				sessions = append(sessions, summarizeSession(session))
			}
		}
	}

	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt > sessions[j].UpdatedAt
	})

	return sessions, nil
}

func ReadChatSession(rootDir, idOrPrefix string) (VaultChatSession, error) {
	stateDir, _ := getVaultPaths(rootDir)
	return loadSession(stateDir, idOrPrefix)
}

func DeleteChatSession(rootDir, idOrPrefix string) (VaultChatSessionSummary, error) {
	stateDir, wikiDir := getVaultPaths(rootDir)

	session, err := loadSession(stateDir, idOrPrefix)
	if err != nil {
		return VaultChatSessionSummary{}, err
	}

	os.Remove(sessionStatePath(stateDir, session.ID))
	os.Remove(sessionMarkdownPath(wikiDir, session.ID))

	return summarizeSession(session), nil
}

func buildPrompt(session VaultChatSession, question string, maxHistoryTurns int) string {
	if maxHistoryTurns < 0 {
		maxHistoryTurns = 0
	}

	var recentTurns []VaultChatTurn
	if len(session.Turns) > maxHistoryTurns {
		recentTurns = session.Turns[len(session.Turns)-maxHistoryTurns:]
	} else {
		recentTurns = session.Turns
	}

	if len(recentTurns) == 0 {
		return question
	}

	var history []string
	for i, turn := range recentTurns {
		var lines []string
		lines = append(lines, fmt.Sprintf("Turn %d", i+1))
		lines = append(lines, fmt.Sprintf("User: %s", turn.Question))
		lines = append(lines, fmt.Sprintf("Assistant: %s", truncate(utils.NormalizeWhitespace(turn.Answer), 1200)))
		if len(turn.Citations) > 0 {
			lines = append(lines, fmt.Sprintf("Citations: %s", strings.Join(turn.Citations, ", ")))
		}
		history = append(history, strings.Join(lines, "\n"))
	}

	return strings.Join([]string{
		"Continue this SwarmVault chat session using the compiled wiki as the source of truth.",
		"Use prior turns only for conversational continuity. Prefer current vault evidence over prior wording.",
		"",
		"Prior turns:",
		strings.Join(history, "\n\n"),
		"",
		"Current question:",
		question,
	}, "\n")
}

func PrepareChatSession(rootDir string, options AskChatOptions, nowStr string) (VaultChatSession, string, error) {
	question := utils.NormalizeWhitespace(options.Question)
	if question == "" {
		return VaultChatSession{}, "", fmt.Errorf("Chat question is required.")
	}

	stateDir, wikiDir := getVaultPaths(rootDir)

	var session VaultChatSession
	var err error
	if options.SessionID != nil && *options.SessionID != "" {
		session, err = loadSession(stateDir, *options.SessionID)
		if err != nil {
			return VaultChatSession{}, "", err
		}
	} else {
		nowTime, _ := time.Parse(time.RFC3339Nano, nowStr)

		var titleVal string
		if options.Title != nil && strings.TrimSpace(*options.Title) != "" {
			titleVal = strings.TrimSpace(*options.Title)
		} else {
			titleVal = utils.NormalizeWhitespace(options.Question)
		}
		title := truncate(titleVal, 80)
		id := fmt.Sprintf("%s-%s", timestampIdPrefix(nowTime), slugify(title))

		session = VaultChatSession{
			ID:           id,
			Title:        title,
			CreatedAt:    nowStr,
			UpdatedAt:    nowStr,
			RootDir:      rootDir,
			MarkdownPath: sessionMarkdownPath(wikiDir, id),
			Turns:        make([]VaultChatTurn, 0),
		}
	}

	maxTurns := DefaultHistoryTurns
	if options.MaxHistoryTurns != nil {
		maxTurns = *options.MaxHistoryTurns
	}

	prompt := buildPrompt(session, question, maxTurns)
	return session, prompt, nil
}

func SaveChatSessionTurn(rootDir string, session VaultChatSession, options AskChatOptions, queryResult QueryResult, nowStr string) (AskChatResult, error) {
	stateDir, wikiDir := getVaultPaths(rootDir)

	turn := VaultChatTurn{
		ID:               fmt.Sprintf("%d", len(session.Turns)+1),
		CreatedAt:        nowStr,
		Question:         utils.NormalizeWhitespace(options.Question),
		Answer:           queryResult.Answer,
		Citations:        queryResult.Citations,
		RelatedPageIDs:   queryResult.RelatedPageIDs,
		RelatedNodeIDs:   queryResult.RelatedNodeIDs,
		RelatedSourceIDs: queryResult.RelatedSourceIDs,
		OutputFormat:     queryResult.OutputFormat,
		SavedPath:        queryResult.SavedPath,
	}

	// Initialize slices if nil to serialize as [] rather than null
	if turn.Citations == nil {
		turn.Citations = make([]string, 0)
	}
	if turn.RelatedPageIDs == nil {
		turn.RelatedPageIDs = make([]string, 0)
	}
	if turn.RelatedNodeIDs == nil {
		turn.RelatedNodeIDs = make([]string, 0)
	}
	if turn.RelatedSourceIDs == nil {
		turn.RelatedSourceIDs = make([]string, 0)
	}

	session.UpdatedAt = nowStr
	session.Turns = append(session.Turns, turn)
	session.MarkdownPath = sessionMarkdownPath(wikiDir, session.ID)

	persisted, err := persistSession(session, stateDir, wikiDir)
	if err != nil {
		return AskChatResult{}, err
	}

	resumed := false
	if options.SessionID != nil && *options.SessionID != "" {
		resumed = true
	}

	return AskChatResult{
		Session:      persisted,
		Turn:         turn,
		Answer:       queryResult.Answer,
		MarkdownPath: persisted.MarkdownPath,
		StatePath:    sessionStatePath(stateDir, session.ID),
		Resumed:      resumed,
	}, nil
}
