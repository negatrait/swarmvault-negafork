package chat

import (
	"regexp"
	"strings"
	"testing"
)

func TestTimestampIdPrefix(t *testing.T) {
	prefix := timestampIdPrefix()
	// Depending on time.Now().UTC().Format() execution, the milliseconds could be `.000Z` or just `Z`
	// The original TypeScript code: .replace(/\.\d{3}Z$/u, "Z") means it explicitly strips the milliseconds
	// and just appends 'Z'. E.g. "20240101-120000Z". Let's check regex against that.
	matched, _ := regexp.MatchString(`^\d{8}-\d{6}Z$`, prefix)
	if !matched {
		t.Errorf("expected format YYYYMMDD-HHMMSSZ, got %s", prefix)
	}
}

func TestRenderSessionMarkdown(t *testing.T) {
	session := VaultChatSession{
		ID:        "test-session",
		Title:     "Test Session",
		CreatedAt: "2024-01-01T00:00:00.000Z",
		UpdatedAt: "2024-01-01T00:01:00.000Z",
		Turns: []VaultChatTurn{
			{
				ID:        "1",
				CreatedAt: "2024-01-01T00:00:00.000Z",
				Question:  "What is the meaning of life?",
				Answer:    "42",
			},
			{
				ID:        "2",
				CreatedAt: "2024-01-01T00:01:00.000Z",
				Question:  "Where are we?",
				Answer:    "Earth",
				Citations: []string{"Source 1"},
			},
		},
	}

	markdown := renderSessionMarkdown(session)

	// Verify frontmatter
	if !strings.Contains(markdown, "session_id: test-session") {
		t.Errorf("missing session_id in frontmatter")
	}
	if !strings.Contains(markdown, "page_id: chat:test-session") {
		t.Errorf("missing page_id in frontmatter")
	}

	// Verify body
	if !strings.Contains(markdown, "# Test Session") {
		t.Errorf("missing title in body")
	}
	if !strings.Contains(markdown, "Session ID: `test-session`") {
		t.Errorf("missing session ID line")
	}
	if !strings.Contains(markdown, "## Turn 1 - 2024-01-01T00:00:00.000Z") {
		t.Errorf("missing turn 1 header")
	}
	if !strings.Contains(markdown, "### Question\n\nWhat is the meaning of life?") {
		t.Errorf("missing turn 1 question")
	}
	if !strings.Contains(markdown, "### Citations\n\n- Source 1") {
		t.Errorf("missing citations block")
	}
}

func TestBuildPrompt(t *testing.T) {
	session := VaultChatSession{
		Turns: []VaultChatTurn{
			{Question: "Q1", Answer: "A1"},
			{Question: "Q2", Answer: "A2"},
			{Question: "Q3", Answer: "A3"},
		},
	}

	prompt := buildPrompt(session, "Current Q", 2)

	if strings.Contains(prompt, "Q1") {
		t.Errorf("should only include last 2 turns, but included Q1")
	}
	if !strings.Contains(prompt, "Turn 1\nUser: Q2\nAssistant: A2") {
		t.Errorf("missing Q2 turn formatting")
	}
	if !strings.Contains(prompt, "Turn 2\nUser: Q3\nAssistant: A3") {
		t.Errorf("missing Q3 turn formatting")
	}
	if !strings.Contains(prompt, "Current question:\nCurrent Q") {
		t.Errorf("missing current question")
	}
}
