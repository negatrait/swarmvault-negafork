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

	"gopkg.in/yaml.v3"
)

var (
	hyphenColonRegex = regexp.MustCompile(`[-:]`)
	msRegex          = regexp.MustCompile(`\.\d{3}Z$`)
)

func timestampIdPrefix() string {
	jsIsoString := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	s := hyphenColonRegex.ReplaceAllString(jsIsoString, "")
	s = msRegex.ReplaceAllString(s, "Z")
	s = strings.ReplaceAll(s, "T", "-")
	return s
}

func chatDirs(paths ChatDirsPaths) ChatDirsPaths {
	return ChatDirsPaths{
		StateDir: filepath.Join(paths.StateDir, "chat-sessions"),
		WikiDir:  filepath.Join(paths.WikiDir, "outputs", "chat-sessions"),
	}
}

func sessionStatePath(stateDir string, id string) string {
	return filepath.Join(stateDir, id+".json")
}

func sessionMarkdownPath(wikiDir string, id string) string {
	return filepath.Join(wikiDir, id+".md")
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

func renderSessionMarkdown(session VaultChatSession) string {
	var bodyLines []string
	bodyLines = append(bodyLines, fmt.Sprintf("# %s", session.Title))
	bodyLines = append(bodyLines, "")
	bodyLines = append(bodyLines, fmt.Sprintf("Session ID: `%s`", session.ID))
	bodyLines = append(bodyLines, fmt.Sprintf("Updated: %s", session.UpdatedAt))
	bodyLines = append(bodyLines, "")

	for i, turn := range session.Turns {
		bodyLines = append(bodyLines, fmt.Sprintf("## Turn %d - %s", i+1, turn.CreatedAt))
		bodyLines = append(bodyLines, "")
		bodyLines = append(bodyLines, "### Question")
		bodyLines = append(bodyLines, "")
		bodyLines = append(bodyLines, turn.Question)
		bodyLines = append(bodyLines, "")
		bodyLines = append(bodyLines, "### Answer")
		bodyLines = append(bodyLines, "")
		bodyLines = append(bodyLines, turn.Answer)
		bodyLines = append(bodyLines, "")

		if len(turn.Citations) > 0 {
			bodyLines = append(bodyLines, "### Citations")
			bodyLines = append(bodyLines, "")
			for _, citation := range turn.Citations {
				bodyLines = append(bodyLines, fmt.Sprintf("- %s", citation))
			}
		}

		if turn.SavedPath != nil && *turn.SavedPath != "" {
			bodyLines = append(bodyLines, "")
			bodyLines = append(bodyLines, fmt.Sprintf("Saved output: `%s`", *turn.SavedPath))
		}
		bodyLines = append(bodyLines, "")
	}

	body := strings.Join(bodyLines, "\n")

	frontmatter := map[string]interface{}{
		"session_id":    session.ID,
		"title":         session.Title,
		"created_at":    session.CreatedAt,
		"updated_at":    session.UpdatedAt,
		"turn_count":    len(session.Turns),
		"page_id":       fmt.Sprintf("chat:%s", session.ID),
		"freshness":     "fresh",
		"node_ids":      []string{},
		"source_ids":    []string{},
		"source_hashes": map[string]interface{}{},
	}

	yamlBytes, err := yaml.Marshal(frontmatter)
	if err != nil {
		return body
	}

	return fmt.Sprintf("---\n%s---\n%s\n", string(yamlBytes), body)
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max-3] + "..."
	}
	return s
}

func normalizeWhitespace(s string) string {
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

func buildPrompt(session VaultChatSession, question string, maxHistoryTurns int) string {
	start := len(session.Turns) - maxHistoryTurns
	if start < 0 {
		start = 0
	}
	recentTurns := session.Turns[start:]

	if len(recentTurns) == 0 {
		return question
	}

	var historyLines []string
	for i, turn := range recentTurns {
		var turnLines []string
		turnLines = append(turnLines, fmt.Sprintf("Turn %d", i+1))
		turnLines = append(turnLines, fmt.Sprintf("User: %s", turn.Question))
		turnLines = append(turnLines, fmt.Sprintf("Assistant: %s", truncate(normalizeWhitespace(turn.Answer), 1200)))

		if len(turn.Citations) > 0 {
			turnLines = append(turnLines, fmt.Sprintf("Citations: %s", strings.Join(turn.Citations, ", ")))
		}

		historyLines = append(historyLines, strings.Join(turnLines, "\n"))
	}

	history := strings.Join(historyLines, "\n\n")

	var promptLines []string
	promptLines = append(promptLines, "Continue this SwarmVault chat session using the compiled wiki as the source of truth.")
	promptLines = append(promptLines, "Use prior turns only for conversational continuity. Prefer current vault evidence over prior wording.")
	promptLines = append(promptLines, "")
	promptLines = append(promptLines, "Prior turns:")
	promptLines = append(promptLines, history)
	promptLines = append(promptLines, "")
	promptLines = append(promptLines, "Current question:")
	promptLines = append(promptLines, question)

	return strings.Join(promptLines, "\n")
}

func persistSession(session VaultChatSession, stateDir string, wikiDir string) (string, string, error) {
	if err := os.MkdirAll(stateDir, 0755); err != nil {
		return "", "", err
	}
	if err := os.MkdirAll(wikiDir, 0755); err != nil {
		return "", "", err
	}

	statePath := sessionStatePath(stateDir, session.ID)
	markdownPath := sessionMarkdownPath(wikiDir, session.ID)

	persisted := session
	persisted.MarkdownPath = markdownPath

	stateBytes, err := json.MarshalIndent(persisted, "", "  ")
	if err != nil {
		return "", "", err
	}
	if err := os.WriteFile(statePath, stateBytes, 0644); err != nil {
		return "", "", err
	}

	markdownContent := renderSessionMarkdown(persisted)
	if err := os.WriteFile(markdownPath, []byte(markdownContent), 0644); err != nil {
		return "", "", err
	}

	return statePath, markdownPath, nil
}

func resolveSessionId(stateDir string, idOrPrefix string) (string, error) {
	direct := sessionStatePath(stateDir, idOrPrefix)
	if _, err := os.Stat(direct); err == nil {
		return idOrPrefix, nil
	}

	entries, err := os.ReadDir(stateDir)
	if err != nil {
		// Treat non-existent dir as empty entries
		if os.IsNotExist(err) {
			return "", fmt.Errorf("Chat session not found: %s", idOrPrefix)
		}
		return "", err
	}

	var matches []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".json") {
			id := name[:len(name)-len(".json")]
			if strings.HasPrefix(id, idOrPrefix) {
				matches = append(matches, id)
			}
		}
	}

	if len(matches) == 1 {
		return matches[0], nil
	}
	if len(matches) > 1 {
		end := 8
		if len(matches) < 8 {
			end = len(matches)
		}
		return "", fmt.Errorf("Chat session prefix %q is ambiguous: %s", idOrPrefix, strings.Join(matches[:end], ", "))
	}

	return "", fmt.Errorf("Chat session not found: %s", idOrPrefix)
}

func loadSession(stateDir string, idOrPrefix string) (*VaultChatSession, error) {
	id, err := resolveSessionId(stateDir, idOrPrefix)
	if err != nil {
		return nil, err
	}

	path := sessionStatePath(stateDir, id)
	bytes, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var session VaultChatSession
	if err := json.Unmarshal(bytes, &session); err != nil {
		return nil, err
	}

	return &session, nil
}

func slugify(s string) string {
	s = strings.ToLower(s)
	re := regexp.MustCompile(`[^a-z0-9]+`)
	s = re.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func createSession(rootDir string, wikiDir string, options AskChatOptions, now string) VaultChatSession {
	var title string
	if options.Title != nil && strings.TrimSpace(*options.Title) != "" {
		title = truncate(strings.TrimSpace(*options.Title), 80)
	} else {
		title = truncate(normalizeWhitespace(options.Question), 80)
	}

	id := fmt.Sprintf("%s-%s", timestampIdPrefix(), slugify(title))

	return VaultChatSession{
		ID:           id,
		Title:        title,
		CreatedAt:    now,
		UpdatedAt:    now,
		RootDir:      rootDir,
		MarkdownPath: sessionMarkdownPath(wikiDir, id),
		Turns:        make([]VaultChatTurn, 0),
	}
}

func ListChatSessions(rootDir string, paths ChatDirsPaths) ([]VaultChatSessionSummary, error) {
	stateDir := chatDirs(paths).StateDir

	entries, err := os.ReadDir(stateDir)
	if err != nil {
		if os.IsNotExist(err) {
			return make([]VaultChatSessionSummary, 0), nil
		}
		return nil, err
	}

	var sessions []VaultChatSessionSummary

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		path := filepath.Join(stateDir, entry.Name())
		bytes, err := os.ReadFile(path)
		if err != nil {
			continue // Skip unreadable
		}

		var session VaultChatSession
		if err := json.Unmarshal(bytes, &session); err != nil {
			continue // Skip unparseable
		}

		sessions = append(sessions, summarizeSession(session))
	}

	// Sort descending by updated at
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt > sessions[j].UpdatedAt
	})

	if sessions == nil {
		sessions = make([]VaultChatSessionSummary, 0)
	}

	return sessions, nil
}

func ReadChatSession(rootDir string, paths ChatDirsPaths, idOrPrefix string) (*VaultChatSession, error) {
	stateDir := chatDirs(paths).StateDir
	return loadSession(stateDir, idOrPrefix)
}

func DeleteChatSession(rootDir string, paths ChatDirsPaths, idOrPrefix string) (*VaultChatSessionSummary, error) {
	stateDir := chatDirs(paths).StateDir
	wikiDir := chatDirs(paths).WikiDir

	session, err := loadSession(stateDir, idOrPrefix)
	if err != nil {
		return nil, err
	}

	statePath := sessionStatePath(stateDir, session.ID)
	markdownPath := sessionMarkdownPath(wikiDir, session.ID)

	_ = os.Remove(statePath)
	_ = os.Remove(markdownPath)

	summary := summarizeSession(*session)
	return &summary, nil
}

func AskChatSession(rootDir string, paths ChatDirsPaths, options AskChatOptions) (*AskChatResult, error) {
	// queryVault is outside the scope of this file port.
	// As per instructions, bridge/mock it or write a TODO.
	return nil, fmt.Errorf("TODO(port): askChatSession requires queryVault port")
}
