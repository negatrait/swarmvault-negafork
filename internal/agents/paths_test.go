package agents

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInstallScope(t *testing.T) {
	cases := []struct {
		agent    AgentType
		scope    string
		expected string
	}{
		{agentHermes, "", scopeUser},
		{agentHermes, "project", "project"},
		{agentAntigravity, "", "project"},
		{agentAntigravity, "user", "user"},
	}

	for _, c := range cases {
		opt := InstallAgentOptions{Scope: c.scope}
		res := installScope(c.agent, opt)
		if res != c.expected {
			t.Errorf("installScope(%s, scope=%q) = %q; want %q", c.agent, c.scope, res, c.expected)
		}
	}
}

func TestPrimaryTargetPathForAgent(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	rootDir := t.TempDir()

	cases := []struct {
		agent          AgentType
		scope          string
		expectedSuffix string
		expectErr      bool
	}{
		{agentHermes, "user", filepath.Join(".hermes", "skills", "swarmvault", "SKILL.md"), false},
		{agentAntigravity, "project", filepath.Join(".agents", "rules", "swarmvault.md"), false},
		{agentClaude, "project", "CLAUDE.md", false},
		{agentGemini, "project", "GEMINI.md", false},
		{"unknown-agent-xyz", "project", "", true},
	}

	for _, c := range cases {
		opt := InstallAgentOptions{Scope: c.scope}
		res, err := primaryTargetPathForAgent(rootDir, c.agent, opt)
		if c.expectErr {
			if err == nil {
				t.Errorf("expected error for agent %s, got nil", c.agent)
			}
		} else {
			if err != nil {
				t.Errorf("unexpected error for agent %s: %v", c.agent, err)
			}
			if !strings.HasPrefix(res, rootDir) && !strings.HasPrefix(res, os.Getenv("HOME")) {
				t.Errorf("expected path %q to have prefix %q or %q", res, rootDir, os.Getenv("HOME"))
			}
			if !strings.HasSuffix(res, c.expectedSuffix) {
				t.Errorf("expected path %q to have suffix %q", res, c.expectedSuffix)
			}
		}
	}
}

func TestTargetsForAgent(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	rootDir := t.TempDir()

	opt := InstallAgentOptions{Scope: "project"}
	targets, err := targetsForAgent(rootDir, agentAntigravity, opt)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(targets) != 3 {
		t.Errorf("expected 3 targets for antigravity, got %d: %v", len(targets), targets)
	}

	hookTrue := true
	optWithHook := InstallAgentOptions{Scope: "project", Hook: &hookTrue}
	targetsHook, err := targetsForAgent(rootDir, agentGemini, optWithHook)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(targetsHook) < 3 {
		t.Errorf("expected at least 3 targets for gemini with hook, got %d: %v", len(targetsHook), targetsHook)
	}
}

func TestGetAgentInstallStatus(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	rootDir := t.TempDir()

	opt := InstallAgentOptions{Scope: "project"}
	status, err := GetAgentInstallStatus(rootDir, agentAntigravity, opt)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.Installed {
		t.Errorf("expected status.Installed to be false when files don't exist")
	}

	for _, tStat := range status.Targets {
		err := os.MkdirAll(filepath.Dir(tStat.Path), 0755)
		if err != nil {
			t.Fatal(err)
		}
		err = os.WriteFile(tStat.Path, []byte("test"), 0644)
		if err != nil {
			t.Fatal(err)
		}
	}

	status, err = GetAgentInstallStatus(rootDir, agentAntigravity, opt)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !status.Installed {
		t.Errorf("expected status.Installed to be true after creating all target files")
	}
}
