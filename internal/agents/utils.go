package agents

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Agents []AgentType `json:"agents"`
}

type Workspace struct {
	Config Config `json:"config"`
}

func initWorkspace(rootDir string) (Workspace, error) {
	configPath := filepath.Join(rootDir, "swarmvault.config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return Workspace{}, err
	}
	var w Workspace
	if err := json.Unmarshal(data, &w.Config); err != nil {
		return Workspace{}, err
	}
	return w, nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func ensureDir(dir string) error {
	return os.MkdirAll(dir, 0755)
}

type JsonWarningResult struct {
	Data     map[string]interface{}
	Warnings []string
}

func readJsonWithWarnings(filePath string, label string) JsonWarningResult {
	if !fileExists(filePath) {
		return JsonWarningResult{Data: make(map[string]interface{}), Warnings: []string{}}
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		return JsonWarningResult{Data: make(map[string]interface{}), Warnings: []string{fmt.Sprintf("Could not read %s. Left the existing file unchanged.", label)}}
	}
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return JsonWarningResult{Data: make(map[string]interface{}), Warnings: []string{fmt.Sprintf("Could not parse %s. Left the existing file unchanged.", label)}}
	}
	return JsonWarningResult{Data: parsed, Warnings: []string{}}
}

func stripJsonComments(source string) string {
	var output strings.Builder
	inString := false
	escaped := false
	inLineComment := false
	inBlockComment := false

	chars := []rune(source)
	for i := 0; i < len(chars); i++ {
		current := chars[i]
		var next rune
		if i+1 < len(chars) {
			next = chars[i+1]
		}

		if inLineComment {
			if current == '\n' || current == '\r' {
				inLineComment = false
				output.WriteRune(current)
			}
			continue
		}

		if inBlockComment {
			if current == '*' && next == '/' {
				inBlockComment = false
				i++
			} else if current == '\n' || current == '\r' {
				output.WriteRune(current)
			}
			continue
		}

		if inString {
			output.WriteRune(current)
			if escaped {
				escaped = false
			} else if current == '\\' {
				escaped = true
			} else if current == '"' {
				inString = false
			}
			continue
		}

		if current == '"' {
			inString = true
			output.WriteRune(current)
			continue
		}

		if current == '/' && next == '/' {
			inLineComment = true
			i++
			continue
		}

		if current == '/' && next == '*' {
			inBlockComment = true
			i++
			continue
		}

		output.WriteRune(current)
	}

	return output.String()
}

func readJsonOrJsoncWithWarnings(jsonPath string, jsoncPath string, label string) JsonWarningResult {
	if fileExists(jsonPath) {
		return readJsonWithWarnings(jsonPath, label)
	}
	if !fileExists(jsoncPath) {
		return JsonWarningResult{Data: make(map[string]interface{}), Warnings: []string{}}
	}
	data, err := os.ReadFile(jsoncPath)
	if err != nil {
		return JsonWarningResult{Data: make(map[string]interface{}), Warnings: []string{fmt.Sprintf("Could not read %s. Left the existing file unchanged.", label)}}
	}

	stripped := stripJsonComments(string(data))
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(stripped), &parsed); err != nil {
		return JsonWarningResult{Data: make(map[string]interface{}), Warnings: []string{fmt.Sprintf("Could not parse %s. Left the existing file unchanged.", label)}}
	}
	return JsonWarningResult{Data: parsed, Warnings: []string{}}
}

type ClaudeHookEntry struct {
	Matcher string                   `json:"matcher,omitempty"`
	Hooks   []map[string]interface{} `json:"hooks,omitempty"`
}

func isSwarmvaultClaudeEntry(entry ClaudeHookEntry) bool {
	data, _ := json.Marshal(entry)
	return strings.Contains(string(data), "swarmvault-graph-first.js")
}

func keepForeign(entries []interface{}) []ClaudeHookEntry {
	var result []ClaudeHookEntry
	for _, raw := range entries {
		data, _ := json.Marshal(raw)
		var entry ClaudeHookEntry
		json.Unmarshal(data, &entry)
		if !isSwarmvaultClaudeEntry(entry) {
			result = append(result, entry)
		}
	}
	return result
}

func mergeClaudeHookSettings(settings map[string]interface{}, scriptCommandPath string) map[string]interface{} {
	sessionCommand := fmt.Sprintf(`node "%s" session-start`, scriptCommandPath)
	preToolUseCommand := fmt.Sprintf(`node "%s" pre-tool-use`, scriptCommandPath)
	postEditCommand := fmt.Sprintf(`node "%s" post-edit`, scriptCommandPath)

	hooks, ok := settings["hooks"].(map[string]interface{})
	if !ok {
		hooks = make(map[string]interface{})
	}

	sessionStartRaw, _ := hooks["SessionStart"].([]interface{})
	sessionStart := keepForeign(sessionStartRaw)
	for _, matcher := range claudeSessionMatchers {
		sessionStart = append(sessionStart, ClaudeHookEntry{
			Matcher: matcher,
			Hooks:   []map[string]interface{}{{"type": "command", "command": sessionCommand}},
		})
	}

	preToolUseRaw, _ := hooks["PreToolUse"].([]interface{})
	preToolUse := keepForeign(preToolUseRaw)
	for _, matcher := range claudePreToolUseMatchers {
		preToolUse = append(preToolUse, ClaudeHookEntry{
			Matcher: matcher,
			Hooks:   []map[string]interface{}{{"type": "command", "command": preToolUseCommand}},
		})
	}

	postToolUseRaw, _ := hooks["PostToolUse"].([]interface{})
	postToolUse := keepForeign(postToolUseRaw)
	postToolUse = append(postToolUse, ClaudeHookEntry{
		Matcher: claudePostEditMatcher,
		Hooks:   []map[string]interface{}{{"type": "command", "command": postEditCommand}},
	})

	hooks["SessionStart"] = sessionStart
	hooks["PreToolUse"] = preToolUse
	hooks["PostToolUse"] = postToolUse
	settings["hooks"] = hooks

	return settings
}

func readBuiltHook(hookFile string) (string, error) {
	// The Go sidecar handles hook logic via JS still.
	// Since the TS engine wraps the call, we emulate reading from dist/hooks.
	// We'll read from `node_modules/@swarmvaultai/engine/dist/hooks` relative to rootDir
	// This is a simplified approach, in production the TS side handles JS hooks.
	// But to strictly port `agents.ts`, the TS side previously did this.
	// We can cheat here: the Go sidecar is normally executed in the repo.
	// In the TS implementation it looks in BUILT_HOOKS_DIR which is the `dist/hooks` folder of the engine package.
	// To mimic exactly we can try the same paths but relative to the workspace root or the engine root.
	// We will find the absolute path of the workspace root and traverse from there.
	pwd, _ := os.Getwd()
	// Since we are running tests, the workspace root is 2 levels up from `packages/engine`
	// But we just search iteratively upwards to find `packages/engine/dist/hooks`
	dir := pwd
	for i := 0; i < 5; i++ {
		candidate := filepath.Join(dir, "packages", "engine", "dist", "hooks", hookFile)
		if fileExists(candidate) {
			data, _ := os.ReadFile(candidate)
			return string(data), nil
		}
		candidate2 := filepath.Join(dir, "node_modules", "@swarmvaultai", "engine", "dist", "hooks", hookFile)
		if fileExists(candidate2) {
			data, _ := os.ReadFile(candidate2)
			return string(data), nil
		}
		dir = filepath.Dir(dir)
	}
	return "", fmt.Errorf("SwarmVault hook bundle not found: %s", hookFile)
}

func writeOwnedFile(filePath string, content string, executable bool) error {
	if err := ensureDir(filepath.Dir(filePath)); err != nil {
		return err
	}
	perm := os.FileMode(0644)
	if executable {
		perm = 0755
	}
	return os.WriteFile(filePath, []byte(content), perm)
}

func upsertManagedBlock(filePath string, block string) error {
	var existing string
	if fileExists(filePath) {
		data, _ := os.ReadFile(filePath)
		existing = string(data)
	}

	if existing == "" {
		if err := ensureDir(filepath.Dir(filePath)); err != nil {
			return err
		}
		return os.WriteFile(filePath, []byte(block+"\n"), 0644)
	}

	startIndex := strings.Index(existing, managedStart)
	if startIndex == -1 {
		startIndex = strings.Index(existing, legacyManagedStart)
	}
	endIndex := strings.Index(existing, managedEnd)
	if endIndex == -1 {
		endIndex = strings.Index(existing, legacyManagedEnd)
	}

	if startIndex != -1 && endIndex != -1 {
		next := existing[:startIndex] + block + existing[endIndex+len(managedEnd):]
		return os.WriteFile(filePath, []byte(next), 0644)
	}

	return os.WriteFile(filePath, []byte(strings.TrimRight(existing, " \n\t")+"\n\n"+block+"\n"), 0644)
}

func removeLegacyOwnedFile(filePath string, ownedContents []string, warningLabel string) string {
	if !fileExists(filePath) {
		return ""
	}
	data, _ := os.ReadFile(filePath)
	existing := strings.TrimSpace(string(data))

	for _, content := range ownedContents {
		if strings.TrimSpace(content) == existing {
			os.Remove(filePath)
			return ""
		}
	}
	return fmt.Sprintf("%s already exists at %s. Left it unchanged because it no longer matches SwarmVault's managed content.", warningLabel, filePath)
}

func withPluginEntry(config map[string]interface{}, pluginEntry string) map[string]interface{} {
	existingRaw, ok := config["plugins"].([]interface{})
	if !ok {
		existingRaw = []interface{}{}
	}

	found := false
	var existing []string
	for _, item := range existingRaw {
		if str, ok := item.(string); ok {
			existing = append(existing, str)
			if str == pluginEntry {
				found = true
			}
		}
	}

	if !found {
		existing = append(existing, pluginEntry)
	}

	config["plugins"] = existing
	return config
}
