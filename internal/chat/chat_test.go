package chat

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPrepareChatSession(t *testing.T) {
	rootDir := t.TempDir()

	// 1. Error when question is empty
	_, _, err := PrepareChatSession(rootDir, AskChatOptions{}, "2026-06-26T12:00:00Z")
	if err == nil {
		t.Error("expected error for empty question, got nil")
	}

	// 2. Creating a new session
	q := "What is the meaning of life?"
	title := "Meaning of Life"
	opt := AskChatOptions{
		Question: q,
		Title:    &title,
	}
	session, prompt, err := PrepareChatSession(rootDir, opt, "2026-06-26T12:00:00Z")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if session.Title != title {
		t.Errorf("expected title %q, got %q", title, session.Title)
	}
	if !strings.Contains(prompt, q) {
		t.Errorf("expected prompt to contain question %q", q)
	}

	// 3. Loading/resuming an existing session
	stateDir, wikiDir := getVaultPaths(rootDir)
	session.Turns = append(session.Turns, VaultChatTurn{
		ID:       "1",
		Question: "hello",
		Answer:   "world",
	})
	persisted, err := persistSession(session, stateDir, wikiDir)
	if err != nil {
		t.Fatalf("failed to persist session: %v", err)
	}

	optResume := AskChatOptions{
		Question:  "another question",
		SessionID: &persisted.ID,
	}
	resumedSession, promptResume, err := PrepareChatSession(rootDir, optResume, "2026-06-26T12:05:00Z")
	if err != nil {
		t.Fatalf("failed to resume session: %v", err)
	}

	if resumedSession.ID != persisted.ID {
		t.Errorf("expected resumed session ID %q, got %q", persisted.ID, resumedSession.ID)
	}
	if len(resumedSession.Turns) != 1 {
		t.Errorf("expected 1 turn in resumed session, got %d", len(resumedSession.Turns))
	}
	if !strings.Contains(promptResume, "world") {
		t.Errorf("expected resumed prompt to contain prior answer 'world'")
	}
}

func TestSaveChatSessionTurn(t *testing.T) {
	rootDir := t.TempDir()
	stateDir, wikiDir := getVaultPaths(rootDir)

	opt := AskChatOptions{
		Question: "What is 2+2?",
	}
	session := VaultChatSession{
		ID:        "test-session",
		Title:     "Math",
		CreatedAt: "2026-06-26T12:00:00Z",
		UpdatedAt: "2026-06-26T12:00:00Z",
		Turns:     []VaultChatTurn{},
	}
	queryResult := QueryResult{
		Answer:    "It is 4.",
		Citations: []string{"source1.md"},
	}

	res, err := SaveChatSessionTurn(rootDir, session, opt, queryResult, "2026-06-26T12:01:00Z")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Answer != "It is 4." {
		t.Errorf("expected answer 'It is 4.', got %q", res.Answer)
	}
	if len(res.Session.Turns) != 1 {
		t.Fatalf("expected 1 turn, got %d", len(res.Session.Turns))
	}
	if res.Session.Turns[0].Answer != "It is 4." {
		t.Errorf("expected saved turn answer 'It is 4.', got %q", res.Session.Turns[0].Answer)
	}

	stateFile := filepath.Join(stateDir, "test-session.json")
	if _, err := os.Stat(stateFile); os.IsNotExist(err) {
		t.Error("expected state file to exist")
	}

	markdownFile := filepath.Join(wikiDir, "test-session.md")
	mdData, err := os.ReadFile(markdownFile)
	if err != nil {
		t.Fatalf("failed to read markdown file: %v", err)
	}
	if !strings.Contains(string(mdData), "session_id: test-session") {
		t.Errorf("expected markdown to contain session frontmatter")
	}
	if !strings.Contains(string(mdData), "It is 4.") {
		t.Errorf("expected markdown to contain answer")
	}
}

func TestListReadDeleteSessions(t *testing.T) {
	rootDir := t.TempDir()
	stateDir, wikiDir := getVaultPaths(rootDir)

	list, err := ListChatSessions(rootDir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected 0 sessions, got %d", len(list))
	}

	s1 := VaultChatSession{
		ID:        "s1",
		Title:     "Session 1",
		UpdatedAt: "2026-06-26T12:00:00Z",
	}
	s2 := VaultChatSession{
		ID:        "s2",
		Title:     "Session 2",
		UpdatedAt: "2026-06-26T12:10:00Z",
	}

	_, err = persistSession(s1, stateDir, wikiDir)
	if err != nil {
		t.Fatalf("failed to persist s1: %v", err)
	}
	_, err = persistSession(s2, stateDir, wikiDir)
	if err != nil {
		t.Fatalf("failed to persist s2: %v", err)
	}

	list, err = ListChatSessions(rootDir)
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(list))
	}
	if list[0].ID != "s2" || list[1].ID != "s1" {
		t.Errorf("expected sorted sessions: s2 then s1, got %s then %s", list[0].ID, list[1].ID)
	}

	r1, err := ReadChatSession(rootDir, "s1")
	if err != nil {
		t.Fatalf("failed to read exact ID: %v", err)
	}
	if r1.Title != "Session 1" {
		t.Errorf("expected title 'Session 1', got %q", r1.Title)
	}

	deleted, err := DeleteChatSession(rootDir, "s1")
	if err != nil {
		t.Fatalf("failed to delete: %v", err)
	}
	if deleted.ID != "s1" {
		t.Errorf("expected deleted ID 's1', got %q", deleted.ID)
	}

	list, err = ListChatSessions(rootDir)
	if err != nil {
		t.Fatalf("failed to list after delete: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("expected 1 session remaining, got %d", len(list))
	}
}
