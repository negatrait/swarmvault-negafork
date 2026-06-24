package chat

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

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
