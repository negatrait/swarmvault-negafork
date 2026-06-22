package agents

import (
	"os"
	"path/filepath"
)

var agentFileKinds = map[string]string{
	"agents":              "AGENTS.md",
	"claude":              "CLAUDE.md",
	"gemini":              "GEMINI.md",
	"cursor":              ".cursor/rules/swarmvault.mdc",
	"aider":               "CONVENTIONS.md",
	"copilot":             ".github/copilot-instructions.md",
	"trae":                ".trae/rules/swarmvault.md",
	"claw":                ".claw/skills/swarmvault/SKILL.md",
	"droid":               ".factory/rules/swarmvault.md",
	"kiro":                ".kiro/skills/swarmvault/SKILL.md",
	"kiroSteering":        ".kiro/steering/swarmvault.md",
	"antigravityRules":    ".agents/rules/swarmvault.md",
	"antigravityWorkflow": ".agents/workflows/swarmvault.md",
	"devinRules":          ".windsurf/rules/swarmvault.md",
	"vscode":              ".github/chatmodes/swarmvault.chatmode.md",
}

var PROJECT_SKILL_TARGETS = map[AgentType][]string{
	"antigravity": {".agents/skills"},
	"amp":         {".amp/skills"},
	"claude":      {".claude/skills"},
	"codex":       {".agents/skills"},
	"copilot":     {".copilot/skills"},
	"devin":       {".devin/skills"},
	"gemini":      {".gemini/skills"},
	"kimi":        {".kimi/skills"},
	"opencode":    {".opencode/skills"},
	"pi":          {".pi/agent/skills"},
}

var USER_SKILL_TARGETS = map[AgentType]string{
	"antigravity": filepath.Join(".gemini", "config", "skills"),
	"amp":         filepath.Join(".amp", "skills"),
	"claude":      filepath.Join(".claude", "skills"),
	"codex":       filepath.Join(".codex", "skills"),
	"copilot":     filepath.Join(".copilot", "skills"),
	"devin":       filepath.Join(".config", "devin", "skills"),
	"gemini":      filepath.Join(".gemini", "skills"),
	"kimi":        filepath.Join(".kimi", "skills"),
	"kilo":        filepath.Join(".config", "kilo", "skills"),
	"opencode":    filepath.Join(".config", "opencode", "skills"),
}

var SKILL_BUNDLE_AGENTS = map[AgentType]string{
	"amp":          ".config/agents/skills",
	"augment":      ".augment/skills",
	"adal":         ".adal/skills",
	"bob":          ".bob/skills",
	"cline":        ".agents/skills",
	"codebuddy":    ".codebuddy/skills",
	"command-code": ".commandcode/skills",
	"continue":     ".continue/skills",
	"cortex":       ".snowflake/cortex/skills",
	"crush":        ".config/crush/skills",
}

var hermesUserSkillRelative = filepath.Join(".hermes", "skills", "swarmvault", "SKILL.md")

func installScope(agent AgentType, options InstallAgentOptions) string {
	if options.Scope != "" {
		return options.Scope
	}
	if agent == "hermes" {
		return "user"
	}
	return "project"
}

func hermesUserSkillPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, hermesUserSkillRelative)
}

func kiloUserCommandPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".config", "kilo", "command", "swarmvault.md")
}

func claudeUserSettingsPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".claude", "settings.json")
}

func claudeUserHookScriptPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".claude", "hooks", "swarmvault-graph-first.js")
}

func skillBundlePath(baseDir string, relativeSkillsDir string) string {
	return filepath.Join(baseDir, relativeSkillsDir, "swarmvault", "SKILL.md")
}

func projectSkillTargets(rootDir string, agent AgentType) []string {
	targets := []string{}
	if relativeSkillsDirs, ok := PROJECT_SKILL_TARGETS[agent]; ok {
		for _, relativeSkillsDir := range relativeSkillsDirs {
			targets = append(targets, skillBundlePath(rootDir, relativeSkillsDir))
		}
	}
	return targets
}

func userSkillTarget(agent AgentType) *string {
	if relativeSkillsDir, ok := USER_SKILL_TARGETS[agent]; ok {
		homeDir, _ := os.UserHomeDir()
		path := skillBundlePath(homeDir, relativeSkillsDir)
		return &path
	}
	return nil
}

func skillBundleTarget(rootDir string, agent AgentType) *string {
	if relativeSkillsDir, ok := SKILL_BUNDLE_AGENTS[agent]; ok {
		path := filepath.Join(rootDir, relativeSkillsDir, "swarmvault", "SKILL.md")
		return &path
	}
	return nil
}

func supportsAgentHook(agent AgentType) bool {
	return agent == "codex" || agent == "claude" || agent == "opencode" || agent == "gemini" || agent == "copilot" || agent == "kilo"
}

func hookScriptPathForAgent(rootDir string, agent AgentType) *string {
	var path string
	switch agent {
	case "codex":
		path = filepath.Join(rootDir, ".codex", "hooks", "swarmvault-graph-first.js")
	case "claude":
		path = filepath.Join(rootDir, ".claude", "hooks", "swarmvault-graph-first.js")
	case "opencode":
		path = filepath.Join(rootDir, ".opencode", "plugins", "swarmvault-graph-first.js")
	case "kilo":
		path = filepath.Join(rootDir, ".kilo", "plugins", "swarmvault.js")
	case "gemini":
		path = filepath.Join(rootDir, ".gemini", "hooks", "swarmvault-graph-first.js")
	case "copilot":
		path = filepath.Join(rootDir, ".github", "hooks", "swarmvault-graph-first.js")
	default:
		return nil
	}
	return &path
}

func hookConfigPathForAgent(rootDir string, agent AgentType) *string {
	var path string
	switch agent {
	case "codex":
		path = filepath.Join(rootDir, ".codex", "hooks.json")
	case "claude":
		path = filepath.Join(rootDir, ".claude", "settings.json")
	case "gemini":
		path = filepath.Join(rootDir, ".gemini", "settings.json")
	case "opencode":
		path = filepath.Join(rootDir, ".opencode", "opencode.json")
	case "kilo":
		path = filepath.Join(rootDir, ".kilo", "kilo.json")
	case "copilot":
		path = filepath.Join(rootDir, ".github", "hooks", "swarmvault-graph-first.json")
	default:
		return nil
	}
	return &path
}

func primaryTargetPathForAgent(rootDir string, agent AgentType, options InstallAgentOptions) string {
	if installScope(agent, options) == "user" {
		if agent == "hermes" {
			return hermesUserSkillPath()
		}
		target := userSkillTarget(agent)
		if target != nil {
			return *target
		}
	}

	switch agent {
	case "kilo", "codex", "goose", "pi", "opencode":
		return filepath.Join(rootDir, agentFileKinds["agents"])
	case "claude":
		return filepath.Join(rootDir, agentFileKinds["claude"])
	case "gemini":
		return filepath.Join(rootDir, agentFileKinds["gemini"])
	case "cursor":
		return filepath.Join(rootDir, agentFileKinds["cursor"])
	case "aider":
		return filepath.Join(rootDir, agentFileKinds["aider"])
	case "copilot":
		return filepath.Join(rootDir, agentFileKinds["copilot"])
	case "trae":
		return filepath.Join(rootDir, agentFileKinds["trae"])
	case "claw":
		return filepath.Join(rootDir, agentFileKinds["claw"])
	case "droid":
		return filepath.Join(rootDir, agentFileKinds["droid"])
	case "kiro":
		return filepath.Join(rootDir, agentFileKinds["kiro"])
	case "hermes":
		return hermesUserSkillPath()
	case "antigravity":
		return filepath.Join(rootDir, agentFileKinds["antigravityRules"])
	case "vscode":
		return filepath.Join(rootDir, agentFileKinds["vscode"])
	default:
		bundleTarget := skillBundleTarget(rootDir, agent)
		if bundleTarget != nil {
			return *bundleTarget
		}
		panic("Unsupported agent " + string(agent))
	}
}

func targetsForAgent(rootDir string, agent AgentType, options InstallAgentOptions) []string {
	scope := installScope(agent, options)
	targets := []string{primaryTargetPathForAgent(rootDir, agent, options)}

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
		return uniqueStrings(targets)
	}

	if agent == "claude" && options.Mcp != nil && *options.Mcp {
		targets = append(targets, filepath.Join(rootDir, ".mcp.json"))
	}

	if options.Scope == "project" {
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
		if configPath != nil {
			targets = append(targets, *configPath)
		}
		if scriptPath != nil {
			targets = append(targets, *scriptPath)
		}
	}

	return uniqueStrings(targets)
}

func uniqueStrings(input []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, val := range input {
		if !seen[val] {
			seen[val] = true
			result = append(result, val)
		}
	}
	return result
}
