package autocommit

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
)

func Git(rootDir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = rootDir
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out.String()), nil
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

	wikiRelative := strings.TrimPrefix(config.WikiDir, rootDir+"/")
	stateRelative := strings.TrimPrefix(config.StateDir, rootDir+"/")

	// git add wikiRelative stateRelative
	_, _ = Git(rootDir, "add", wikiRelative, stateRelative)

	// git diff --cached --stat
	status, err := Git(rootDir, "diff", "--cached", "--stat")
	if err != nil || status == "" {
		return nil, nil
	}

	message := fmt.Sprintf("vault %s", operation)
	if detail != "" {
		message = fmt.Sprintf("vault %s: %s", operation, detail)
	}

	_, err = Git(rootDir, "commit", "-m", message)
	if err != nil {
		return nil, err
	}

	return &message, nil
}
