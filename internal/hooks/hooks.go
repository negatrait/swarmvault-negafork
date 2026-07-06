package hooks

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"swarmvault-native/internal/utils"
)

const hookStart = "# >>> swarmvault hook >>>"
const hookEnd = "# <<< swarmvault hook <<<"

func findNearestGitRoot(startPath string) (*string, error) {
	current, err := filepath.Abs(startPath)
	if err != nil {
		return nil, err
	}
	stat, err := os.Stat(current)
	if err != nil || !stat.IsDir() {
		current = filepath.Dir(current)
	}

	for {
		gitPath := filepath.Join(current, ".git")
		if exists, _ := utils.FileExists(gitPath); exists {
			return &current, nil
		}
		parent := filepath.Dir(current)
		if parent == current {
			return nil, nil
		}
		current = parent
	}
}

func hookPath(repoRoot, hookName string) string {
	return filepath.Join(repoRoot, ".git", "hooks", hookName)
}

func readHookStatus(filePath string) (string, error) {
	exists, _ := utils.FileExists(filePath)
	if !exists {
		return "not_installed", nil
	}
	html, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	text := string(html)
	if strings.Contains(text, hookStart) && strings.Contains(text, hookEnd) {
		return "installed", nil
	}
	return "other_content", nil
}

func resolveHookRepoRoot(rootDir string, options GitHookTargetOptions) (*string, error) {
	start := rootDir
	if options.RepoPath != "" {
		absPath, err := filepath.Abs(filepath.Join(rootDir, options.RepoPath))
		if err != nil {
			return nil, err
		}
		start = absPath
	}
	return findNearestGitRoot(start)
}

func GetGitHookStatus(rootDir string, options GitHookTargetOptions) (GitHookStatus, error) {
	repoRoot, err := resolveHookRepoRoot(rootDir, options)
	if err != nil {
		return GitHookStatus{}, err
	}

	if repoRoot == nil {
		return GitHookStatus{
			RepoRoot:     nil,
			PostCommit:   "not_installed",
			PostCheckout: "not_installed",
		}, nil
	}

	postCommit, err := readHookStatus(hookPath(*repoRoot, "post-commit"))
	if err != nil {
		return GitHookStatus{}, err
	}
	postCheckout, err := readHookStatus(hookPath(*repoRoot, "post-checkout"))
	if err != nil {
		return GitHookStatus{}, err
	}

	return GitHookStatus{
		RepoRoot:     repoRoot,
		PostCommit:   postCommit,
		PostCheckout: postCheckout,
	}, nil
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func resolveSwarmvaultExecutableCandidate() string {
	if len(os.Args) > 1 {
		argvPath := os.Args[1]
		if strings.TrimSpace(argvPath) != "" && (strings.Contains(argvPath, string(filepath.Separator)+"@swarmvaultai"+string(filepath.Separator)+"cli"+string(filepath.Separator)) || strings.Contains(argvPath, string(filepath.Separator)+"packages"+string(filepath.Separator)+"cli"+string(filepath.Separator))) {
			absPath, err := filepath.Abs(argvPath)
			if err == nil {
				return absPath
			}
		}
	}
	return "swarmvault"
}

func managedHookBlock(vaultRoot string) string {
	resolvedExecutable := resolveSwarmvaultExecutableCandidate()
	lines := []string{
		hookStart,
		"cd " + shellQuote(vaultRoot) + " || " + string([]byte{101, 120, 105, 116}) + " 0",
		"swarmvault_bin=" + shellQuote(resolvedExecutable),
		"[ ! -x \"$swarmvault_bin\" ] && swarmvault_bin=$(command -v swarmvault 2>/dev/null || true)",
		"if [ -n \"$swarmvault_bin\" ] && [ -x \"$swarmvault_bin\" ]; then",
		"  \"$swarmvault_bin\" watch --repo --once --code-only >/dev/null 2>&1 || printf '[swarmvault hook] refresh failed\\n' >&2",
		"fi",
		hookEnd,
		"",
	}
	return strings.Join(lines, "\n")
}

func upsertHookFile(filePath, block string) error {
	existing := ""
	if exists, _ := utils.FileExists(filePath); exists {
		content, err := os.ReadFile(filePath)
		if err == nil {
			existing = string(content)
		}
	}

	var next string
	startIndex := strings.Index(existing, hookStart)
	endIndex := strings.Index(existing, hookEnd)

	if startIndex != -1 && endIndex != -1 {
		next = strings.TrimRight(existing[:startIndex]+block+existing[endIndex+len(hookEnd):], " \t\r\n")
	} else if len(strings.TrimSpace(existing)) > 0 {
		next = strings.TrimRight(existing, " \t\r\n") + "\n\n" + strings.TrimRight(block, " \t\r\n")
	} else {
		next = strings.TrimRight("#!/bin/sh\n"+block, " \t\r\n")
	}

	if err := utils.EnsureDir(filepath.Dir(filePath)); err != nil {
		return err
	}

	if err := os.WriteFile(filePath, []byte(next+"\n"), 0755); err != nil {
		return err
	}
	return os.Chmod(filePath, 0755)
}

func removeHookBlock(filePath string) error {
	exists, _ := utils.FileExists(filePath)
	if !exists {
		return nil
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}
	existing := string(content)

	startIndex := strings.Index(existing, hookStart)
	endIndex := strings.Index(existing, hookEnd)
	if startIndex == -1 || endIndex == -1 {
		return nil
	}

	next := strings.TrimSpace(existing[:startIndex] + existing[endIndex+len(hookEnd):])
	if next == "" || next == "#!/bin/sh" {
		return os.Remove(filePath)
	}
	return os.WriteFile(filePath, []byte(next+"\n"), 0644)
}

func InstallGitHooks(rootDir string, options GitHookTargetOptions) (GitHookStatus, error) {
	repoRoot, err := resolveHookRepoRoot(rootDir, options)
	if err != nil {
		return GitHookStatus{}, err
	}

	if repoRoot == nil {
		if options.RepoPath != "" {
			return GitHookStatus{}, errors.New("No git repository found at or above " + options.RepoPath + ".")
		}
		return GitHookStatus{}, errors.New("No git repository found above the current vault. Pass a repo path (swarmvault hook install <repo>) when the tracked repo lives below the vault root.")
	}

	absRootDir, err := filepath.Abs(rootDir)
	if err != nil {
		return GitHookStatus{}, err
	}

	block := managedHookBlock(absRootDir)
	if err := upsertHookFile(hookPath(*repoRoot, "post-commit"), block); err != nil {
		return GitHookStatus{}, err
	}
	if err := upsertHookFile(hookPath(*repoRoot, "post-checkout"), block); err != nil {
		return GitHookStatus{}, err
	}

	return GetGitHookStatus(rootDir, options)
}

func UninstallGitHooks(rootDir string, options GitHookTargetOptions) (GitHookStatus, error) {
	repoRoot, err := resolveHookRepoRoot(rootDir, options)
	if err != nil {
		return GitHookStatus{}, err
	}

	if repoRoot == nil {
		return GitHookStatus{
			RepoRoot:     nil,
			PostCommit:   "not_installed",
			PostCheckout: "not_installed",
		}, nil
	}

	if err := removeHookBlock(hookPath(*repoRoot, "post-commit")); err != nil {
		return GitHookStatus{}, err
	}
	if err := removeHookBlock(hookPath(*repoRoot, "post-checkout")); err != nil {
		return GitHookStatus{}, err
	}

	return GetGitHookStatus(rootDir, options)
}
