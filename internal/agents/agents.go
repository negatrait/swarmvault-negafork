package agents

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"gopkg.in/yaml.v3"
	"os"
	"path/filepath"
	"strings"
)

// Add yaml pkg to go.mod

func buildManagedBlock(target string) string {
	var heading string
	if target == "aider" {
		heading = "# SwarmVault Conventions"
	} else if target == "copilot" {
		heading = "# SwarmVault Repository Instructions"
	} else {
		heading = "# SwarmVault Rules"
	}

	var extra []string
	if target == "copilot" {
		extra = []string{
			"",
			"For architecture, structure, relationship, add/modify/find, or component-location questions, read the graph report first when it exists. Use source files after that when the graph lacks detail, is stale, or you are making a specific edit.",
		}
	} else if target == "claude" {
		extra = []string{
			"",
			"For architecture, structure, where-is, what-calls, or impact questions, query the graph first: `swarmvault graph query \"<seed>\"` (top matches + inline page excerpt), `swarmvault graph explain \"<node>\"`, or `swarmvault graph blast <target>` for impact. Avoid `--json` — the plain output is far smaller. Trust the graph answer for orientation; read source files only when you are editing them or the graph lacks the detail you need. Check freshness with `swarmvault graph status` and refresh with `swarmvault graph update` (add `--file <path>` for single files).",
		}
	}

	var parts []string
	parts = append(parts, managedStart, heading, "")
	parts = append(parts, SWARMVAULT_RULE_BULLETS...)
	parts = append(parts, extra...)
	parts = append(parts, managedEnd, "")
	return strings.Join(parts, "\n")
}

func buildSkillFrontmatter() string {
	data := map[string]interface{}{
		"name":        "swarmvault",
		"description": "SwarmVault graph-first workflow. Use to read the compiled wiki and query the knowledge graph before broad file search.",
	}
	bytes, _ := yaml.Marshal(data)
	return "---\n" + strings.TrimRight(string(bytes), "\n") + "\n---"
}

func buildSkillBody() string {
	parts := []string{
		"# SwarmVault",
		"",
		"SwarmVault compiles curated sources in `raw/` into a queryable wiki in `wiki/` and a knowledge graph in `state/graph.json`.",
		"",
		"## Rules",
		"",
	}
	parts = append(parts, SWARMVAULT_RULE_BULLETS...)
	parts = append(parts, []string{
		"",
		"## Entry points",
		"",
		"- `swarmvault ingest <path>` — register a new source",
		"- `swarmvault compile` — refresh wiki pages and graph",
		"- `swarmvault query \"<question>\"` — save-first multi-step query",
		"- `swarmvault graph query|path|explain` — deterministic graph traversal",
		"- `swarmvault lint` — wiki health and contradiction checks",
		"",
	}...)
	return strings.Join(parts, "\n")
}

func buildStandaloneSkillFile() string {
	return buildSkillFrontmatter() + "\n\n" + buildSkillBody()
}

func buildKiroSteeringFile() string {
	data := map[string]interface{}{
		"inclusion":   "always",
		"description": "Always-on SwarmVault rules.",
	}
	bytes, _ := yaml.Marshal(data)
	parts := []string{
		"---",
		strings.TrimRight(string(bytes), "\n"),
		"---",
		"",
		"# SwarmVault Rules",
		"",
	}
	parts = append(parts, SWARMVAULT_RULE_BULLETS...)
	parts = append(parts, "")
	return strings.Join(parts, "\n")
}

func buildAntigravityRulesFile(ruleBullets []string) string {
	if ruleBullets == nil {
		ruleBullets = SWARMVAULT_RULE_BULLETS
	}
	data := map[string]interface{}{
		"alwaysApply": true,
		"description": "SwarmVault graph-first repository rules.",
	}
	bytes, _ := yaml.Marshal(data)
	parts := []string{
		"---",
		strings.TrimRight(string(bytes), "\n"),
		"---",
		"",
		"# SwarmVault Rules",
		"",
	}
	parts = append(parts, ruleBullets...)
	parts = append(parts, []string{
		"",
		"> MCP navigation hint: SwarmVault exposes a local MCP server via `swarmvault mcp`. Wire it into your Antigravity MCP config to query the graph without shelling out.",
	}...)
	return strings.Join(parts, "\n")
}

func buildAntigravityWorkflowFile() string {
	data := map[string]interface{}{
		"command":     "swarmvault",
		"description": "Compile, query, and lint the SwarmVault vault.",
	}
	bytes, _ := yaml.Marshal(data)
	parts := []string{
		"---",
		strings.TrimRight(string(bytes), "\n"),
		"---",
		"",
		"# /swarmvault",
		"",
		"Run SwarmVault against the current directory.",
		"",
		"## Steps",
		"",
		"1. If no vault exists, run `swarmvault init`.",
		"2. For new sources, run `swarmvault ingest <path>`.",
		"3. Run `swarmvault compile` to refresh the wiki and graph.",
		"4. For follow-up questions, prefer `swarmvault query`, `swarmvault graph query`, `swarmvault graph path`, `swarmvault graph explain`.",
		"5. Save high-value answers to `wiki/outputs/`.",
		"",
	}
	return strings.Join(parts, "\n")
}

func buildKiloCommandFile() string {
	return strings.Join([]string{
		"# /swarmvault",
		"",
		"Use SwarmVault's graph-first workflow in the current project.",
		"",
		"1. If no vault exists, run `swarmvault init`.",
		"2. Read `wiki/graph/report.md` before broad source search when it exists.",
		"3. Prefer `swarmvault graph query`, `swarmvault graph path`, and `swarmvault graph explain` for structure questions.",
		"4. Run `swarmvault compile` after adding or refreshing sources.",
		"",
	}, "\n")
}

func buildKiloPluginFile() string {
	return strings.Join([]string{
		"export default async function SwarmVaultPlugin({ project }) {",
		"  return {",
		"    name: 'swarmvault-graph-first',",
		"    async beforeToolUse(event) {",
		"      const toolName = event?.tool?.name ?? event?.toolName ?? '';",
		"      if (!['bash', 'shell', 'terminal', 'search', 'grep', 'glob'].includes(String(toolName).toLowerCase())) return;",
		"      const root = project?.root ?? process.cwd();",
		"      return {",
		"        message: `SwarmVault graph-first: from ${root}, answer structure questions with swarmvault graph query/explain/path or swarmvault query instead of broad search; wiki/graph/report.md has the orientation report. Read source files only when editing them or when the graph lacks detail.`",
		"      };",
		"    }",
		"  };",
		"}",
		"",
	}, "\n")
}

func buildVscodeChatmodeFile() string {
	data := map[string]interface{}{
		"description": "SwarmVault graph-first workflow for VS Code Copilot Chat.",
		"tools":       []string{"codebase", "terminal"},
	}
	bytes, _ := yaml.Marshal(data)
	parts := []string{
		"---",
		strings.TrimRight(string(bytes), "\n"),
		"---",
		"",
		"# SwarmVault mode",
		"",
		"You are working inside a SwarmVault vault. Follow these rules before other actions:",
		"",
		"For any question about this repo's architecture, structure, components, relationships, or where/how to add or modify code, first read `wiki/graph/report.md` when it exists. If `SWARMVAULT_OUT` is set, read `$SWARMVAULT_OUT/wiki/graph/report.md` instead.",
		"",
	}
	parts = append(parts, SWARMVAULT_RULE_BULLETS...)
	parts = append(parts, []string{
		"",
		"Use the terminal tool to run `swarmvault` commands. Prefer graph queries over broad grep/glob. Read source files after the graph when you are modifying/debugging specific code, the graph lacks needed detail, or the graph is stale.",
		"",
	}...)
	return strings.Join(parts, "\n")
}

func buildCursorRule() string {
	data := map[string]interface{}{
		"description": "SwarmVault graph-first repository instructions.",
		"alwaysApply": true,
	}
	bytes, _ := yaml.Marshal(data)
	parts := []string{
		"---",
		strings.TrimRight(string(bytes), "\n"),
		"---",
		"",
		strings.TrimRight(buildManagedBlock("cursor"), "\n"),
		"",
	}
	return strings.Join(parts, "\n")
}

func supportsAgentHook(agent AgentType) bool {
	return agent == "codex" || agent == "claude" || agent == "opencode" || agent == "gemini" || agent == "copilot" || agent == "kilo"
}

func installScope(agent AgentType, options InstallAgentOptions) string {
	if options.Scope != nil {
		return *options.Scope
	}
	if agent == "hermes" {
		return "user"
	}
	return "project"
}

func hermesUserSkillPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".hermes", "skills", "swarmvault", "SKILL.md")
}

func kiloUserCommandPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "kilo", "command", "swarmvault.md")
}

func userSkillTarget(agent AgentType) string {
	relativeSkillsDir, ok := USER_SKILL_TARGETS[agent]
	if !ok {
		return ""
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, relativeSkillsDir, "swarmvault", "SKILL.md")
}

func skillBundleTarget(rootDir string, agent AgentType) string {
	relativeSkillsDir, ok := SKILL_BUNDLE_AGENTS[string(agent)]
	if !ok {
		return ""
	}
	return filepath.Join(rootDir, relativeSkillsDir, "swarmvault", "SKILL.md")
}

func projectSkillTargets(rootDir string, agent AgentType) []string {
	targets, ok := PROJECT_SKILL_TARGETS[agent]
	if !ok {
		return nil
	}
	var res []string
	for _, relativeSkillsDir := range targets {
		res = append(res, filepath.Join(rootDir, relativeSkillsDir, "swarmvault", "SKILL.md"))
	}
	return res
}

func primaryTargetPathForAgent(rootDir string, agent AgentType, options InstallAgentOptions) (string, error) {
	if installScope(agent, options) == "user" {
		if agent == "hermes" {
			return hermesUserSkillPath(), nil
		}
		target := userSkillTarget(agent)
		if target != "" {
			return target, nil
		}
	}
	switch agent {
	case "kilo", "codex", "goose", "pi", "opencode":
		return filepath.Join(rootDir, agentFileKinds["agents"]), nil
	case "claude":
		return filepath.Join(rootDir, agentFileKinds["claude"]), nil
	case "gemini":
		return filepath.Join(rootDir, agentFileKinds["gemini"]), nil
	case "cursor":
		return filepath.Join(rootDir, agentFileKinds["cursor"]), nil
	case "aider":
		return filepath.Join(rootDir, agentFileKinds["aider"]), nil
	case "copilot":
		return filepath.Join(rootDir, agentFileKinds["copilot"]), nil
	case "trae":
		return filepath.Join(rootDir, agentFileKinds["trae"]), nil
	case "claw":
		return filepath.Join(rootDir, agentFileKinds["claw"]), nil
	case "droid":
		return filepath.Join(rootDir, agentFileKinds["droid"]), nil
	case "kiro":
		return filepath.Join(rootDir, agentFileKinds["kiro"]), nil
	case "hermes":
		return hermesUserSkillPath(), nil
	case "antigravity":
		return filepath.Join(rootDir, agentFileKinds["antigravityRules"]), nil
	case "vscode":
		return filepath.Join(rootDir, agentFileKinds["vscode"]), nil
	default:
		bundleTarget := skillBundleTarget(rootDir, agent)
		if bundleTarget != "" {
			return bundleTarget, nil
		}
		return "", fmt.Errorf("Unsupported agent %s", string(agent))
	}
}

func claudeUserSettingsPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude", "settings.json")
}

func claudeUserHookScriptPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude", "hooks", "swarmvault-graph-first.js")
}

func hookConfigPathForAgent(rootDir string, agent AgentType) string {
	switch agent {
	case "codex":
		return filepath.Join(rootDir, ".codex", "hooks.json")
	case "claude":
		return filepath.Join(rootDir, ".claude", "settings.json")
	case "gemini":
		return filepath.Join(rootDir, ".gemini", "settings.json")
	case "opencode":
		return filepath.Join(rootDir, ".opencode", "opencode.json")
	case "kilo":
		return filepath.Join(rootDir, ".kilo", "kilo.json")
	case "copilot":
		return filepath.Join(rootDir, ".github", "hooks", "swarmvault-graph-first.json")
	default:
		return ""
	}
}

func hookScriptPathForAgent(rootDir string, agent AgentType) string {
	switch agent {
	case "codex":
		return filepath.Join(rootDir, ".codex", "hooks", "swarmvault-graph-first.js")
	case "claude":
		return filepath.Join(rootDir, ".claude", "hooks", "swarmvault-graph-first.js")
	case "opencode":
		return filepath.Join(rootDir, ".opencode", "plugins", "swarmvault-graph-first.js")
	case "kilo":
		return filepath.Join(rootDir, ".kilo", "plugins", "swarmvault.js")
	case "gemini":
		return filepath.Join(rootDir, ".gemini", "hooks", "swarmvault-graph-first.js")
	case "copilot":
		return filepath.Join(rootDir, ".github", "hooks", "swarmvault-graph-first.js")
	default:
		return ""
	}
}

func targetsForAgent(rootDir string, agent AgentType, options InstallAgentOptions) []string {
	scope := installScope(agent, options)
	target, _ := primaryTargetPathForAgent(rootDir, agent, options)
	targets := []string{target}

	if scope == "user" {
		if agent == "kilo" {
			targets = append(targets, kiloUserCommandPath())
		}
		if agent == "hermes" {
			targets = append(targets, filepath.Join(rootDir, agentFileKinds["agents"]))
		}
		if agent == "claude" && options.Hook != nil && *options.Hook {
			targets = append(targets, claudeUserSettingsPath(), claudeUserHookScriptPath())
		}
		return uniqueStrs(targets)
	}

	if agent == "claude" && options.Mcp != nil && *options.Mcp {
		targets = append(targets, filepath.Join(rootDir, ".mcp.json"))
	}

	if options.Scope != nil && *options.Scope == "project" {
		targets = append(targets, projectSkillTargets(rootDir, agent)...)
	}

	if agent == "copilot" {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds["agents"]))
	}

	if agent == "vscode" {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds["copilot"]))
	}

	if agent == "aider" {
		targets = append(targets, filepath.Join(rootDir, ".aider.conf.yml"))
	}

	if agent == "kiro" {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds["kiroSteering"]))
	}

	if agent == "hermes" {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds["agents"]))
	}

	if agent == "antigravity" {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds["antigravityWorkflow"]))
	}

	if agent == "devin" {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds["devinRules"]))
	}

	if options.Hook != nil && *options.Hook && supportsAgentHook(agent) {
		configPath := hookConfigPathForAgent(rootDir, agent)
		scriptPath := hookScriptPathForAgent(rootDir, agent)
		if configPath != "" {
			targets = append(targets, configPath)
		}
		if scriptPath != "" {
			targets = append(targets, scriptPath)
		}
	}

	return uniqueStrs(targets)
}

func uniqueStrs(strs []string) []string {
	keys := make(map[string]bool)
	list := []string{}
	for _, entry := range strs {
		if _, value := keys[entry]; !value {
			keys[entry] = true
			list = append(list, entry)
		}
	}
	return list
}

func cleanupLegacyAntigravityFiles(rootDir string) []string {
	legacyRulesPath := filepath.Join(rootDir, legacyAntigravityFileKinds["antigravityRules"])
	legacyWorkflowPath := filepath.Join(rootDir, legacyAntigravityFileKinds["antigravityWorkflow"])

	w1 := removeLegacyOwnedFile(legacyRulesPath, []string{
		buildAntigravityRulesFile(nil),
		buildAntigravityRulesFile(PRE_GRAPH_FIRST_RULE_BULLETS),
		buildAntigravityRulesFile(LEGACY_SWARMVAULT_RULE_BULLETS),
	}, "Legacy Antigravity rules file")

	w2 := removeLegacyOwnedFile(legacyWorkflowPath, []string{buildAntigravityWorkflowFile()}, "Legacy Antigravity workflow file")

	var warnings []string
	if w1 != "" {
		warnings = append(warnings, w1)
	}
	if w2 != "" {
		warnings = append(warnings, w2)
	}
	return warnings
}

func installClaudeHook(rootDir string) (string, []string, error) {
	settingsPath := filepath.Join(rootDir, ".claude", "settings.json")
	scriptPath := filepath.Join(rootDir, ".claude", "hooks", "swarmvault-graph-first.js")
	hookContent, _ := readBuiltHook("claude.js")
	writeOwnedFile(scriptPath, hookContent, true)
	ensureDir(filepath.Dir(settingsPath))

	res := readJsonWithWarnings(settingsPath, ".claude/settings.json")
	if len(res.Warnings) > 0 && fileExists(settingsPath) {
		return settingsPath, res.Warnings, nil
	}

	merged := mergeClaudeHookSettings(res.Data, "$CLAUDE_PROJECT_DIR/.claude/hooks/swarmvault-graph-first.js")
	data, _ := json.MarshalIndent(merged, "", "  ")
	os.WriteFile(settingsPath, append(data, '\n'), 0644)
	return settingsPath, []string{}, nil
}

func installClaudeUserHook() ([]string, []string, error) {
	settingsPath := claudeUserSettingsPath()
	scriptPath := claudeUserHookScriptPath()
	hookContent, _ := readBuiltHook("claude.js")
	writeOwnedFile(scriptPath, hookContent, true)
	ensureDir(filepath.Dir(settingsPath))

	res := readJsonWithWarnings(settingsPath, "~/.claude/settings.json")
	if len(res.Warnings) > 0 && fileExists(settingsPath) {
		return []string{settingsPath, scriptPath}, res.Warnings, nil
	}

	merged := mergeClaudeHookSettings(res.Data, "$HOME/.claude/hooks/swarmvault-graph-first.js")
	data, _ := json.MarshalIndent(merged, "", "  ")
	os.WriteFile(settingsPath, append(data, '\n'), 0644)
	return []string{settingsPath, scriptPath}, []string{}, nil
}

func installGeminiHook(rootDir string) ([]string, []string, error) {
	settingsPath := filepath.Join(rootDir, ".gemini", "settings.json")
	scriptPath := filepath.Join(rootDir, ".gemini", "hooks", "swarmvault-graph-first.js")
	hookContent, _ := readBuiltHook("gemini.js")
	writeOwnedFile(scriptPath, hookContent, true)

	res := readJsonWithWarnings(settingsPath, ".gemini/settings.json")
	if len(res.Warnings) > 0 && fileExists(settingsPath) {
		return []string{settingsPath, scriptPath}, res.Warnings, nil
	}

	hooks, _ := res.Data["hooks"].(map[string]interface{})
	if hooks == nil {
		hooks = make(map[string]interface{})
	}

	sessionStart, _ := hooks["SessionStart"].([]interface{})
	beforeTool, _ := hooks["BeforeTool"].([]interface{})
	sessionCommand := "node .gemini/hooks/swarmvault-graph-first.js session-start"
	beforeToolCommand := "node .gemini/hooks/swarmvault-graph-first.js before-tool"

	hasSession := false
	for _, entryRaw := range sessionStart {
		data, _ := json.Marshal(entryRaw)
		if strings.Contains(string(data), geminiSessionMatcher) && strings.Contains(string(data), "swarmvault-graph-first.js") {
			hasSession = true
			break
		}
	}
	if !hasSession {
		sessionStart = append(sessionStart, map[string]interface{}{
			"matcher": geminiSessionMatcher,
			"hooks":   []map[string]interface{}{{"name": "swarmvault-graph-first", "type": "command", "command": sessionCommand}},
		})
	}

	hasBefore := false
	for _, entryRaw := range beforeTool {
		data, _ := json.Marshal(entryRaw)
		if strings.Contains(string(data), geminiSearchMatcher) && strings.Contains(string(data), "swarmvault-graph-first.js") {
			hasBefore = true
			break
		}
	}
	if !hasBefore {
		beforeTool = append(beforeTool, map[string]interface{}{
			"matcher": geminiSearchMatcher,
			"hooks":   []map[string]interface{}{{"name": "swarmvault-graph-first", "type": "command", "command": beforeToolCommand}},
		})
	}

	hooks["SessionStart"] = sessionStart
	hooks["BeforeTool"] = beforeTool
	res.Data["hooks"] = hooks

	data, _ := json.MarshalIndent(res.Data, "", "  ")
	writeOwnedFile(settingsPath, string(append(data, '\n')), false)
	return []string{settingsPath, scriptPath}, []string{}, nil
}

func installCodexHook(rootDir string) ([]string, []string, error) {
	settingsPath := filepath.Join(rootDir, ".codex", "hooks.json")
	scriptPath := filepath.Join(rootDir, ".codex", "hooks", "swarmvault-graph-first.js")
	hookContent, _ := readBuiltHook("codex.js")
	writeOwnedFile(scriptPath, hookContent, true)

	res := readJsonWithWarnings(settingsPath, ".codex/hooks.json")
	if len(res.Warnings) > 0 && fileExists(settingsPath) {
		return []string{settingsPath, scriptPath}, res.Warnings, nil
	}

	hooks, _ := res.Data["hooks"].(map[string]interface{})
	if hooks == nil {
		hooks = make(map[string]interface{})
	}

	sessionStart, _ := hooks["SessionStart"].([]interface{})
	preToolUse, _ := hooks["PreToolUse"].([]interface{})
	sessionCommand := "node .codex/hooks/swarmvault-graph-first.js session-start"
	preToolUseCommand := "node .codex/hooks/swarmvault-graph-first.js pre-tool-use"

	hasSession := false
	for _, entryRaw := range sessionStart {
		data, _ := json.Marshal(entryRaw)
		if strings.Contains(string(data), "swarmvault-graph-first.js") {
			hasSession = true
			break
		}
	}
	if !hasSession {
		sessionStart = append(sessionStart, map[string]interface{}{
			"hooks": []map[string]interface{}{{"type": "command", "command": sessionCommand}},
		})
	}

	hasPre := false
	for _, entryRaw := range preToolUse {
		data, _ := json.Marshal(entryRaw)
		if strings.Contains(string(data), codexSearchMatcher) && strings.Contains(string(data), "swarmvault-graph-first.js") {
			hasPre = true
			break
		}
	}
	if !hasPre {
		preToolUse = append(preToolUse, map[string]interface{}{
			"matcher": codexSearchMatcher,
			"hooks":   []map[string]interface{}{{"type": "command", "command": preToolUseCommand}},
		})
	}

	hooks["SessionStart"] = sessionStart
	hooks["PreToolUse"] = preToolUse
	res.Data["hooks"] = hooks

	data, _ := json.MarshalIndent(res.Data, "", "  ")
	writeOwnedFile(settingsPath, string(append(data, '\n')), false)
	return []string{settingsPath, scriptPath}, []string{}, nil
}

func installCopilotHook(rootDir string) ([]string, []string, error) {
	hooksDir := filepath.Join(rootDir, ".github", "hooks")
	scriptPath := filepath.Join(hooksDir, "swarmvault-graph-first.js")
	configPath := filepath.Join(hooksDir, "swarmvault-graph-first.json")
	hookContent, _ := readBuiltHook("copilot.js")
	writeOwnedFile(scriptPath, hookContent, true)

	config := map[string]interface{}{
		"version": copilotHookVersion,
		"hooks": map[string]interface{}{
			"sessionStart": []map[string]interface{}{
				{
					"type":       "command",
					"bash":       "node .github/hooks/swarmvault-graph-first.js session-start",
					"powershell": "node .github/hooks/swarmvault-graph-first.js session-start",
					"cwd":        ".",
					"timeoutSec": 10,
				},
			},
			"preToolUse": []map[string]interface{}{
				{
					"matcher":    "glob|grep",
					"type":       "command",
					"bash":       "node .github/hooks/swarmvault-graph-first.js pre-tool-use",
					"powershell": "node .github/hooks/swarmvault-graph-first.js pre-tool-use",
					"cwd":        ".",
					"timeoutSec": 10,
				},
			},
		},
	}

	data, _ := json.MarshalIndent(config, "", "  ")
	writeOwnedFile(configPath, string(append(data, '\n')), false)
	return []string{configPath, scriptPath}, []string{}, nil
}

func installOpenCodeHook(rootDir string) ([]string, []string, error) {
	pluginPath := filepath.Join(rootDir, ".opencode", "plugins", "swarmvault-graph-first.js")
	configPath := filepath.Join(rootDir, ".opencode", "opencode.json")
	hookContent, _ := readBuiltHook("opencode.js")
	writeOwnedFile(pluginPath, hookContent, false)

	res := readJsonWithWarnings(configPath, ".opencode/opencode.json")
	if len(res.Warnings) > 0 && fileExists(configPath) {
		return []string{pluginPath, configPath}, res.Warnings, nil
	}

	res.Data = withPluginEntry(res.Data, "./plugins/swarmvault-graph-first.js")
	data, _ := json.MarshalIndent(res.Data, "", "  ")
	writeOwnedFile(configPath, string(append(data, '\n')), false)
	return []string{pluginPath, configPath}, []string{}, nil
}

func installKiloHook(rootDir string) ([]string, []string, error) {
	pluginPath := filepath.Join(rootDir, ".kilo", "plugins", "swarmvault.js")
	configPath := filepath.Join(rootDir, ".kilo", "kilo.json")
	jsoncPath := filepath.Join(rootDir, ".kilo", "kilo.jsonc")
	writeOwnedFile(pluginPath, buildKiloPluginFile(), false)

	res := readJsonOrJsoncWithWarnings(configPath, jsoncPath, ".kilo/kilo.json or .kilo/kilo.jsonc")
	if len(res.Warnings) > 0 && (fileExists(configPath) || fileExists(jsoncPath)) {
		return []string{pluginPath, configPath}, res.Warnings, nil
	}

	res.Data = withPluginEntry(res.Data, "./plugins/swarmvault.js")
	data, _ := json.MarshalIndent(res.Data, "", "  ")
	writeOwnedFile(configPath, string(append(data, '\n')), false)
	return []string{pluginPath, configPath}, []string{}, nil
}

func installClaudeMcp(rootDir string) (string, []string, error) {
	mcpConfigPath := filepath.Join(rootDir, ".mcp.json")
	res := readJsonWithWarnings(mcpConfigPath, ".mcp.json")
	if len(res.Warnings) > 0 && fileExists(mcpConfigPath) {
		return mcpConfigPath, res.Warnings, nil
	}

	mcpServers, ok := res.Data["mcpServers"].(map[string]interface{})
	if !ok {
		mcpServers = make(map[string]interface{})
	}

	if _, exists := mcpServers["swarmvault"]; !exists {
		mcpServers["swarmvault"] = map[string]interface{}{
			"command": "swarmvault",
			"args":    []string{"mcp"},
		}
	}
	res.Data["mcpServers"] = mcpServers

	data, _ := json.MarshalIndent(res.Data, "", "  ")
	writeOwnedFile(mcpConfigPath, string(append(data, '\n')), false)
	return mcpConfigPath, []string{}, nil
}

func mergeAiderConfig(rootDir string) (string, []string, error) {
	configPath := filepath.Join(rootDir, ".aider.conf.yml")
	readTarget := "CONVENTIONS.md"
	if !fileExists(configPath) {
		data := map[string]interface{}{"read": []string{readTarget}}
		bytes, _ := yaml.Marshal(data)
		writeOwnedFile(configPath, string(bytes), false)
		return configPath, []string{}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return configPath, []string{"Could not parse .aider.conf.yml. Left the existing file unchanged; add `read: CONVENTIONS.md` manually."}, nil
	}

	var parsed map[string]interface{}
	if err := yaml.Unmarshal(data, &parsed); err != nil {
		return configPath, []string{"Could not parse .aider.conf.yml. Left the existing file unchanged; add `read: CONVENTIONS.md` manually."}, nil
	}

	readVal := parsed["read"]
	var reads []string
	if slice, ok := readVal.([]interface{}); ok {
		for _, item := range slice {
			if str, ok := item.(string); ok {
				reads = append(reads, str)
			}
		}
	} else if str, ok := readVal.(string); ok {
		reads = []string{str}
	}

	found := false
	for _, v := range reads {
		if v == readTarget {
			found = true
			break
		}
	}

	if !found {
		reads = append(reads, readTarget)
		parsed["read"] = reads
		bytes, _ := yaml.Marshal(parsed)
		writeOwnedFile(configPath, string(bytes), false)
	}

	return configPath, []string{}, nil
}

func persistGraphFirstMode(rootDir string, mode string) ([]string, error) {
	configPath := filepath.Join(rootDir, "swarmvault.config.json")
	if !fileExists(configPath) {
		return []string{"No swarmvault.config.json at " + rootDir + "; run swarmvault init or set hooks.graphFirst manually."}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return []string{"Could not update swarmvault.config.json; set hooks.graphFirst manually."}, nil
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return []string{"Could not update swarmvault.config.json; set hooks.graphFirst manually."}, nil
	}

	hooks, ok := parsed["hooks"].(map[string]interface{})
	if !ok {
		hooks = make(map[string]interface{})
	}
	hooks["graphFirst"] = mode
	parsed["hooks"] = hooks

	out, _ := json.MarshalIndent(parsed, "", "  ")
	os.WriteFile(configPath, append(out, '\n'), 0644)
	return []string{}, nil
}

func ensureHostProjectHygiene(rootDir string) ([]string, []string, error) {
	var notices []string
	var warnings []string

	if os.Getenv("SWARMVAULT_OUT") != "" && strings.TrimSpace(os.Getenv("SWARMVAULT_OUT")) != "" {
		return notices, warnings, nil
	}

	ARTIFACT_DIRS := []string{"raw", "wiki", "state", "agent", "inbox"}
	GITIGNORE_HYGIENE_MARKER := "# swarmvault artifacts"

	if fileExists(filepath.Join(rootDir, ".git")) {
		gitignorePath := filepath.Join(rootDir, ".gitignore")
		existing := ""
		if fileExists(gitignorePath) {
			data, _ := os.ReadFile(gitignorePath)
			existing = string(data)
		}
		if !strings.Contains(existing, GITIGNORE_HYGIENE_MARKER) {
			block := "\n" + GITIGNORE_HYGIENE_MARKER + "\n"
			for _, dir := range ARTIFACT_DIRS {
				block += dir + "/\n"
			}
			block += "swarmvault.config.json\nswarmvault.schema.md\n"

			// Replace trailing newlines with exactly one
			existingTrimmed := strings.TrimRight(existing, "\n")
			if existingTrimmed != "" {
				existingTrimmed += "\n"
			}

			os.WriteFile(gitignorePath, []byte(existingTrimmed+block), 0644)
			notices = append(notices, "Added SwarmVault artifact directories to .gitignore.")
		}
	}

	tsconfigPath := filepath.Join(rootDir, "tsconfig.json")
	if fileExists(tsconfigPath) {
		source, _ := os.ReadFile(tsconfigPath)
		var parsed map[string]interface{}
		err := json.Unmarshal(source, &parsed)
		if err == nil && parsed != nil {
			excludeRaw, _ := parsed["exclude"].([]interface{})
			var exclude []string
			for _, v := range excludeRaw {
				if s, ok := v.(string); ok {
					exclude = append(exclude, s)
				}
			}

			var missing []string
			for _, dir := range ARTIFACT_DIRS {
				found := false
				for _, ex := range exclude {
					if ex == dir || ex == dir+"/" || ex == "./"+dir {
						found = true
						break
					}
				}
				if !found {
					missing = append(missing, dir)
				}
			}

			if len(missing) > 0 {
				exclude = append(exclude, missing...)
				parsed["exclude"] = exclude
				data, _ := json.MarshalIndent(parsed, "", "  ")
				os.WriteFile(tsconfigPath, append(data, '\n'), 0644)
				notices = append(notices, "Excluded SwarmVault artifact directories from tsconfig.json ("+strings.Join(missing, ", ")+").")
			}
		} else {
			var parsedJsonc map[string]interface{}
			stripped := stripJsonComments(string(source))
			if err := json.Unmarshal([]byte(stripped), &parsedJsonc); err == nil {
				warnings = append(warnings, "tsconfig.json contains comments, so it was left unchanged — add "+strings.Join(ARTIFACT_DIRS, ", ")+" to its \"exclude\" array manually so vault artifacts are not type-checked.")
			}
		}
	}

	eslintConfigs := []string{"eslint.config.mjs", "eslint.config.js", "eslint.config.ts", ".eslintrc.json", ".eslintrc.js"}
	for _, candidate := range eslintConfigs {
		if fileExists(filepath.Join(rootDir, candidate)) {
			data, _ := os.ReadFile(filepath.Join(rootDir, candidate))
			content := string(data)
			found := false
			for _, dir := range ARTIFACT_DIRS {
				if strings.Contains(content, "\""+dir+"/**\"") || strings.Contains(content, "'"+dir+"/**'") || strings.Contains(content, "\""+dir+"\"") {
					found = true
					break
				}
			}
			if !found {
				var mapped []string
				for _, dir := range ARTIFACT_DIRS {
					mapped = append(mapped, dir+"/**")
				}
				warnings = append(warnings, "Add SwarmVault artifact directories ("+strings.Join(mapped, ", ")+") to the ignore list in "+candidate+" so stored source copies are not linted.")
			}
			break
		}
	}

	return notices, warnings, nil
}

func stableKeyForAgent(rootDir string, agent AgentType) string {
	if agent == "codex" || agent == "goose" || agent == "pi" {
		return "shared:" + filepath.Join(rootDir, agentFileKinds["agents"])
	}
	opts := InstallAgentOptions{Hook: new(bool)}
	*opts.Hook = supportsAgentHook(agent)
	targets := targetsForAgent(rootDir, agent, opts)

	h := sha1.New()
	h.Write([]byte(strings.Join(targets, "\n")))
	return string(agent) + ":" + hex.EncodeToString(h.Sum(nil))
}

func InstallAgent(rootDir string, agent AgentType, options InstallAgentOptions) (InstallAgentResult, error) {
	initWorkspace(rootDir) // ignoring error since TS does mostly same setup
	scope := installScope(agent, options)
	target, err := primaryTargetPathForAgent(rootDir, agent, options)
	if err != nil {
		return InstallAgentResult{}, err
	}
	var warnings []string

	if scope == "user" {
		if agent == "hermes" {
			upsertManagedBlock(filepath.Join(rootDir, agentFileKinds["agents"]), buildManagedBlock("agents"))
			writeOwnedFile(hermesUserSkillPath(), buildStandaloneSkillFile(), false)
		} else {
			userTarget := userSkillTarget(agent)
			if userTarget == "" {
				return InstallAgentResult{}, fmt.Errorf("User-scope install is not supported for agent %s", string(agent))
			}
			writeOwnedFile(userTarget, buildStandaloneSkillFile(), false)
			if agent == "kilo" {
				writeOwnedFile(kiloUserCommandPath(), buildKiloCommandFile(), false)
			}
			if agent == "claude" && options.Hook != nil && *options.Hook {
				_, warns, _ := installClaudeUserHook()
				warnings = append(warnings, warns...)
			}
		}
		if options.GraphFirst != nil {
			warns, _ := persistGraphFirstMode(rootDir, *options.GraphFirst)
			warnings = append(warnings, warns...)
		}
		targets := targetsForAgent(rootDir, agent, options)
		res := InstallAgentResult{Agent: agent, Target: target, Targets: targets}
		if len(warnings) > 0 {
			res.Warnings = warnings
		}
		return res, nil
	}

	switch agent {
	case "kilo", "codex", "goose", "pi", "opencode":
		upsertManagedBlock(filepath.Join(rootDir, agentFileKinds["agents"]), buildManagedBlock("agents"))
	case "claude":
		upsertManagedBlock(target, buildManagedBlock("claude"))
	case "gemini":
		upsertManagedBlock(target, buildManagedBlock("gemini"))
	case "cursor":
		writeOwnedFile(target, buildCursorRule(), false)
	case "aider":
		upsertManagedBlock(target, buildManagedBlock("aider"))
	case "copilot":
		upsertManagedBlock(filepath.Join(rootDir, agentFileKinds["agents"]), buildManagedBlock("agents"))
		upsertManagedBlock(target, buildManagedBlock("copilot"))
	case "trae":
		writeOwnedFile(target, buildManagedBlock("trae"), false)
	case "claw":
		writeOwnedFile(target, buildManagedBlock("claw"), false)
	case "droid":
		writeOwnedFile(target, buildManagedBlock("droid"), false)
	case "kiro":
		writeOwnedFile(target, buildStandaloneSkillFile(), false)
		writeOwnedFile(filepath.Join(rootDir, agentFileKinds["kiroSteering"]), buildKiroSteeringFile(), false)
	case "hermes":
		upsertManagedBlock(filepath.Join(rootDir, agentFileKinds["agents"]), buildManagedBlock("agents"))
		writeOwnedFile(hermesUserSkillPath(), buildStandaloneSkillFile(), false)
	case "antigravity":
		writeOwnedFile(target, buildAntigravityRulesFile(nil), false)
		writeOwnedFile(filepath.Join(rootDir, agentFileKinds["antigravityWorkflow"]), buildAntigravityWorkflowFile(), false)
		warnings = append(warnings, cleanupLegacyAntigravityFiles(rootDir)...)
	case "vscode":
		writeOwnedFile(target, buildVscodeChatmodeFile(), false)
		upsertManagedBlock(filepath.Join(rootDir, agentFileKinds["copilot"]), buildManagedBlock("copilot"))
	default:
		if skillBundleTarget(rootDir, agent) != "" {
			writeOwnedFile(target, buildStandaloneSkillFile(), false)
		} else {
			return InstallAgentResult{}, fmt.Errorf("Unsupported agent %s", string(agent))
		}
	}

	if agent == "aider" {
		_, warns, _ := mergeAiderConfig(rootDir)
		warnings = append(warnings, warns...)
	}

	if options.Scope != nil && *options.Scope == "project" {
		for _, skillTarget := range projectSkillTargets(rootDir, agent) {
			writeOwnedFile(skillTarget, buildStandaloneSkillFile(), false)
		}
	}

	if agent == "devin" {
		writeOwnedFile(filepath.Join(rootDir, agentFileKinds["devinRules"]), buildManagedBlock("devinRules"), false)
	}

	if options.Hook != nil && *options.Hook && supportsAgentHook(agent) {
		switch agent {
		case "codex":
			_, warns, _ := installCodexHook(rootDir)
			warnings = append(warnings, warns...)
		case "claude":
			_, warns, _ := installClaudeHook(rootDir)
			warnings = append(warnings, warns...)
		case "opencode":
			_, warns, _ := installOpenCodeHook(rootDir)
			warnings = append(warnings, warns...)
		case "kilo":
			_, warns, _ := installKiloHook(rootDir)
			warnings = append(warnings, warns...)
		case "gemini":
			_, warns, _ := installGeminiHook(rootDir)
			warnings = append(warnings, warns...)
		case "copilot":
			_, warns, _ := installCopilotHook(rootDir)
			warnings = append(warnings, warns...)
		}
	}

	if options.Mcp != nil && *options.Mcp && agent == "claude" {
		_, warns, _ := installClaudeMcp(rootDir)
		warnings = append(warnings, warns...)
	}

	if options.GraphFirst != nil {
		warns, _ := persistGraphFirstMode(rootDir, *options.GraphFirst)
		warnings = append(warnings, warns...)
	}

	notices, warns, _ := ensureHostProjectHygiene(rootDir)
	warnings = append(warnings, warns...)

	targets := targetsForAgent(rootDir, agent, options)
	base := InstallAgentResult{Agent: agent, Target: target, Targets: targets}
	if len(notices) > 0 {
		base.Notices = notices
	}
	if len(warnings) > 0 {
		base.Warnings = warnings
	}

	return base, nil
}

func GetAgentInstallStatus(rootDir string, agent AgentType, options InstallAgentOptions) (AgentInstallStatus, error) {
	target, _ := primaryTargetPathForAgent(rootDir, agent, options)
	targets := targetsForAgent(rootDir, agent, options)

	var targetStatuses []AgentInstallTargetStatus
	allInstalled := len(targets) > 0

	for _, targetPath := range targets {
		exists := fileExists(targetPath)
		targetStatuses = append(targetStatuses, AgentInstallTargetStatus{
			Path:   targetPath,
			Exists: exists,
		})
		if !exists {
			allInstalled = false
		}
	}

	hook := false
	if options.Hook != nil {
		hook = *options.Hook
	}

	return AgentInstallStatus{
		Agent:     agent,
		Scope:     installScope(agent, options),
		Hook:      hook,
		Target:    target,
		Targets:   targetStatuses,
		Installed: allInstalled,
	}, nil
}

func InstallConfiguredAgents(rootDir string) ([]InstallAgentResult, error) {
	w, _ := initWorkspace(rootDir)

	dedupedAgents := make(map[string]AgentType)
	var agentOrder []AgentType

	for _, agent := range w.Config.Agents {
		key := stableKeyForAgent(rootDir, agent)
		if _, ok := dedupedAgents[key]; !ok {
			dedupedAgents[key] = agent
			agentOrder = append(agentOrder, agent)
		}
	}

	var results []InstallAgentResult
	for _, agent := range agentOrder {
		hook := supportsAgentHook(agent)
		res, err := InstallAgent(rootDir, agent, InstallAgentOptions{Hook: &hook})
		if err != nil {
			return nil, err
		}
		results = append(results, res)
	}

	return results, nil
}
