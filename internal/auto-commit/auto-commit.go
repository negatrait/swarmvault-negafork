package autocommit

import (
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

// Git runs a git command and returns its stdout or an error with stderr details.
func Git(rootDir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = rootDir
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git error: %w (stderr: %q)", err, stderr.String())
	}
	return strings.TrimSpace(stdout.String()), nil
}

func IsGitRepo(rootDir string) bool {
	_, err := Git(rootDir, "rev-parse", "--is-inside-work-tree")
	return err == nil
}

type AutoCommitOptions struct {
	Force bool `json:"force,omitempty"`
}

type VaultConfigPayload struct {
	AutoCommit bool   `json:"autoCommit"`
	WikiDir    string `json:"wikiDir"`
	StateDir   string `json:"stateDir"`
}

func AutoCommitWikiChanges(rootDir string, operation string, detail string, config VaultConfigPayload, options AutoCommitOptions) (*string, error) {
	if !options.Force && !config.AutoCommit {
		return nil, nil
	}

	if !IsGitRepo(rootDir) {
		return nil, nil
	}

	wikiRelative, err := filepath.Rel(rootDir, config.WikiDir)
	if err != nil {
		return nil, fmt.Errorf("invalid wiki directory path relative to root: %w", err)
	}
	stateRelative, err := filepath.Rel(rootDir, config.StateDir)
	if err != nil {
		return nil, fmt.Errorf("invalid state directory path relative to root: %w", err)
	}

	// git add wikiRelative stateRelative
	if _, err := Git(rootDir, "add", wikiRelative, stateRelative); err != nil {
		return nil, err
	}

	// git diff --cached --stat
	status, err := Git(rootDir, "diff", "--cached", "--stat")
	if err != nil || status == "" {
		return nil, nil
	}

	message := fmt.Sprintf("vault %s", operation)
	if detail != "" {
		message = fmt.Sprintf("vault %s: %s", operation, detail)
	}

	if _, err := Git(rootDir, "commit", "-m", message); err != nil {
		return nil, err
	}

	return &message, nil
}
