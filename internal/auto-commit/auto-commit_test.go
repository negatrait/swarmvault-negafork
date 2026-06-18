package autocommit

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func setupTestGitRepo(t *testing.T) string {
	dir := t.TempDir()

	// Create required directories
	err := os.MkdirAll(filepath.Join(dir, "wiki"), 0755)
	if err != nil {
		t.Fatal(err)
	}
	err = os.MkdirAll(filepath.Join(dir, "state"), 0755)
	if err != nil {
		t.Fatal(err)
	}

	cmd := exec.Command("git", "init")
	cmd.Dir = dir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	cmd = exec.Command("git", "config", "user.email", "test@example.com")
	cmd.Dir = dir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	cmd = exec.Command("git", "config", "user.name", "Test User")
	cmd.Dir = dir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	err = os.WriteFile(filepath.Join(dir, "wiki", "init.md"), []byte("init"), 0644)
	if err != nil {
		t.Fatal(err)
	}

	cmd = exec.Command("git", "add", ".")
	cmd.Dir = dir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	cmd = exec.Command("git", "commit", "-m", "init")
	cmd.Dir = dir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	return dir
}

func TestIsGitRepo(t *testing.T) {
	t.Run("returns true for git repo", func(t *testing.T) {
		dir := setupTestGitRepo(t)
		if !IsGitRepo(dir) {
			t.Errorf("Expected IsGitRepo to return true")
		}
	})

	t.Run("returns false for non-git repo", func(t *testing.T) {
		dir := t.TempDir()
		if IsGitRepo(dir) {
			t.Errorf("Expected IsGitRepo to return false")
		}
	})
}

func TestAutoCommitWikiChanges(t *testing.T) {
	t.Run("skips when autoCommit is false and no force", func(t *testing.T) {
		dir := setupTestGitRepo(t)

		config := VaultConfigPayload{
			AutoCommit: false,
			WikiDir:    filepath.Join(dir, "wiki"),
			StateDir:   filepath.Join(dir, "state"),
		}

		msg, err := AutoCommitWikiChanges(dir, "test", "detail", config, AutoCommitOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if msg != nil {
			t.Errorf("Expected msg to be nil, got %v", *msg)
		}
	})

	t.Run("commits when forced even if autoCommit is false", func(t *testing.T) {
		dir := setupTestGitRepo(t)

		// Create a file to commit
		err := os.WriteFile(filepath.Join(dir, "wiki", "test.md"), []byte("test content"), 0644)
		if err != nil {
			t.Fatal(err)
		}

		config := VaultConfigPayload{
			AutoCommit: false,
			WikiDir:    filepath.Join(dir, "wiki"),
			StateDir:   filepath.Join(dir, "state"),
		}

		msg, err := AutoCommitWikiChanges(dir, "test", "detail", config, AutoCommitOptions{Force: true})
		if err != nil {
			t.Fatal(err)
		}

		if msg == nil {
			t.Fatal("Expected commit message, got nil")
		}
		expected := "vault test: detail"
		if *msg != expected {
			t.Errorf("Expected message %q, got %q", expected, *msg)
		}
	})

	t.Run("commits when autoCommit is true", func(t *testing.T) {
		dir := setupTestGitRepo(t)

		// Create a file to commit
		err := os.WriteFile(filepath.Join(dir, "wiki", "test.md"), []byte("test content"), 0644)
		if err != nil {
			t.Fatal(err)
		}

		config := VaultConfigPayload{
			AutoCommit: true,
			WikiDir:    filepath.Join(dir, "wiki"),
			StateDir:   filepath.Join(dir, "state"),
		}

		msg, err := AutoCommitWikiChanges(dir, "test", "detail", config, AutoCommitOptions{})
		if err != nil {
			t.Fatal(err)
		}

		if msg == nil {
			t.Fatal("Expected commit message, got nil")
		}
		expected := "vault test: detail"
		if *msg != expected {
			t.Errorf("Expected message %q, got %q", expected, *msg)
		}
	})

	t.Run("skips when no changes to commit", func(t *testing.T) {
		dir := setupTestGitRepo(t)

		config := VaultConfigPayload{
			AutoCommit: true,
			WikiDir:    filepath.Join(dir, "wiki"),
			StateDir:   filepath.Join(dir, "state"),
		}

		msg, err := AutoCommitWikiChanges(dir, "test", "detail", config, AutoCommitOptions{})
		if err != nil {
			t.Fatal(err)
		}

		if msg != nil {
			t.Errorf("Expected msg to be nil, got %v", *msg)
		}
	})
}
