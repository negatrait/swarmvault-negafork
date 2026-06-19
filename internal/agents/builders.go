package agents

import (
	"os"
	"path/filepath"
)

var AgentFileKinds = map[string]string{
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

var SkillBundleAgents = map[AgentType]string{
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
	"deepagents":   ".deepagents/agent/skills",
	"devin":        ".devin/skills",
	"firebender":   ".firebender/skills",
	"iflow":        ".iflow/skills",
	"junie":        ".junie/skills",
	"kilo-code":    ".kilocode/skills",
	"kimi":         ".config/agents/skills",
	"kode":         ".kode/skills",
	"mcpjam":       ".mcpjam/skills",
	"mistral-vibe": ".vibe/skills",
	"mux":          ".mux/skills",
	"neovate":      ".neovate/skills",
	"openclaw":     ".openclaw/skills",
	"openhands":    ".openhands/skills",
	"pochi":        ".pochi/skills",
	"qoder":        ".qoder/skills",
	"qwen-code":    ".qwen/skills",
	"replit":       ".config/agents/skills",
	"roo-code":     ".roo/skills",
	"trae-cn":      ".trae-cn/skills",
	"warp":         ".agents/skills",
	"windsurf":     ".codeium/windsurf/skills",
	"zencoder":     ".zencoder/skills",
}

var ProjectSkillTargets = map[AgentType][]string{
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
	"vscode":      {".copilot/skills"},
}

var UserSkillTargets = map[AgentType]string{
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
	"pi":          filepath.Join(".pi", "agent", "skills"),
	"vscode":      filepath.Join(".copilot", "skills"),
}

func SkillBundleTarget(rootDir string, agent AgentType) *string {
	relativeSkillsDir, ok := SkillBundleAgents[agent]
	if !ok {
		return nil
	}
	target := filepath.Join(rootDir, relativeSkillsDir, "swarmvault", "SKILL.md")
	return &target
}

func SkillBundlePath(baseDir string, relativeSkillsDir string) string {
	return filepath.Join(baseDir, relativeSkillsDir, "swarmvault", "SKILL.md")
}

func ProjectSkillTargetsForAgent(rootDir string, agent AgentType) []string {
	targets, ok := ProjectSkillTargets[agent]
	if !ok {
		return []string{}
	}
	var res []string
	for _, relativeSkillsDir := range targets {
		res = append(res, SkillBundlePath(rootDir, relativeSkillsDir))
	}
	return res
}

func UserSkillTarget(agent AgentType) *string {
	relativeSkillsDir, ok := UserSkillTargets[agent]
	if !ok {
		return nil
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	target := SkillBundlePath(homeDir, relativeSkillsDir)
	return &target
}

func HermesUserSkillPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".hermes", "skills", "swarmvault", "SKILL.md")
}

func KiloUserCommandPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".config", "kilo", "command", "swarmvault.md")
}

func HookScriptPathForAgent(rootDir string, agent AgentType) *string {
	var target string
	switch agent {
	case "codex":
		target = filepath.Join(rootDir, ".codex", "hooks", "swarmvault-graph-first.js")
	case "claude":
		target = filepath.Join(rootDir, ".claude", "hooks", "swarmvault-graph-first.js")
	case "opencode":
		target = filepath.Join(rootDir, ".opencode", "plugins", "swarmvault-graph-first.js")
	case "kilo":
		target = filepath.Join(rootDir, ".kilo", "plugins", "swarmvault.js")
	case "gemini":
		target = filepath.Join(rootDir, ".gemini", "hooks", "swarmvault-graph-first.js")
	case "copilot":
		target = filepath.Join(rootDir, ".github", "hooks", "swarmvault-graph-first.js")
	default:
		return nil
	}
	return &target
}

func HookConfigPathForAgent(rootDir string, agent AgentType) *string {
	var target string
	switch agent {
	case "codex":
		target = filepath.Join(rootDir, ".codex", "hooks.json")
	case "claude":
		target = filepath.Join(rootDir, ".claude", "settings.json")
	case "gemini":
		target = filepath.Join(rootDir, ".gemini", "settings.json")
	case "opencode":
		target = filepath.Join(rootDir, ".opencode", "opencode.json")
	case "kilo":
		target = filepath.Join(rootDir, ".kilo", "kilo.json")
	case "copilot":
		target = filepath.Join(rootDir, ".github", "hooks", "swarmvault-graph-first.json")
	default:
		return nil
	}
	return &target
}

func SupportsAgentHook(agent AgentType) bool {
	return agent == "codex" || agent == "claude" || agent == "opencode" || agent == "gemini" || agent == "copilot" || agent == "kilo"
}

func InstallScope(agent AgentType, options *InstallAgentOptions) string {
	if options != nil && options.Scope != nil {
		return *options.Scope
	}
	if agent == "hermes" {
		return "user"
	}
	return "project"
}

func PrimaryTargetPathForAgent(rootDir string, agent AgentType, options *InstallAgentOptions) string {
	if InstallScope(agent, options) == "user" {
		if agent == "hermes" {
			return HermesUserSkillPath()
		}
		target := UserSkillTarget(agent)
		if target != nil {
			return *target
		}
	}
	switch agent {
	case "kilo", "codex", "goose", "pi", "opencode":
		return filepath.Join(rootDir, AgentFileKinds["agents"])
	case "claude":
		return filepath.Join(rootDir, AgentFileKinds["claude"])
	case "gemini":
		return filepath.Join(rootDir, AgentFileKinds["gemini"])
	case "cursor":
		return filepath.Join(rootDir, AgentFileKinds["cursor"])
	case "aider":
		return filepath.Join(rootDir, AgentFileKinds["aider"])
	case "copilot":
		return filepath.Join(rootDir, AgentFileKinds["copilot"])
	case "trae":
		return filepath.Join(rootDir, AgentFileKinds["trae"])
	case "claw":
		return filepath.Join(rootDir, AgentFileKinds["claw"])
	case "droid":
		return filepath.Join(rootDir, AgentFileKinds["droid"])
	case "kiro":
		return filepath.Join(rootDir, AgentFileKinds["kiro"])
	case "hermes":
		return HermesUserSkillPath()
	case "antigravity":
		return filepath.Join(rootDir, AgentFileKinds["antigravityRules"])
	case "vscode":
		return filepath.Join(rootDir, AgentFileKinds["vscode"])
	default:
		bundleTarget := SkillBundleTarget(rootDir, agent)
		if bundleTarget != nil {
			return *bundleTarget
		}
		return ""
	}
}

func TargetsForAgent(rootDir string, agent AgentType, options *InstallAgentOptions) []string {
	scope := InstallScope(agent, options)
	targetSet := make(map[string]bool)
	targets := []string{}

	addTarget := func(t string) {
		if !targetSet[t] {
			targetSet[t] = true
			targets = append(targets, t)
		}
	}

	addTarget(PrimaryTargetPathForAgent(rootDir, agent, options))

	if scope == "user" {
		if agent == "kilo" {
			addTarget(KiloUserCommandPath())
		}
		if agent == "hermes" {
			addTarget(filepath.Join(rootDir, AgentFileKinds["agents"]))
		}
		if agent == "claude" && options != nil && options.Hook != nil && *options.Hook {
			homeDir, _ := os.UserHomeDir()
			addTarget(filepath.Join(homeDir, ".claude", "settings.json"))
			addTarget(filepath.Join(homeDir, ".claude", "hooks", "swarmvault-graph-first.js"))
		}
		return targets
	}

	if agent == "claude" && options != nil && options.Mcp != nil && *options.Mcp {
		addTarget(filepath.Join(rootDir, ".mcp.json"))
	}

	if options != nil && options.Scope != nil && *options.Scope == "project" {
		for _, pt := range ProjectSkillTargetsForAgent(rootDir, agent) {
			addTarget(pt)
		}
	}

	if agent == "copilot" {
		addTarget(filepath.Join(rootDir, AgentFileKinds["agents"]))
	}

	if agent == "vscode" {
		addTarget(filepath.Join(rootDir, AgentFileKinds["copilot"]))
	}

	if agent == "aider" {
		addTarget(filepath.Join(rootDir, ".aider.conf.yml"))
	}

	if agent == "kiro" {
		addTarget(filepath.Join(rootDir, AgentFileKinds["kiroSteering"]))
	}

	if agent == "hermes" {
		addTarget(filepath.Join(rootDir, AgentFileKinds["agents"]))
	}

	if agent == "antigravity" {
		addTarget(filepath.Join(rootDir, AgentFileKinds["antigravityWorkflow"]))
	}

	if agent == "devin" {
		addTarget(filepath.Join(rootDir, AgentFileKinds["devinRules"]))
	}

	if options != nil && options.Hook != nil && *options.Hook && SupportsAgentHook(agent) {
		configPath := HookConfigPathForAgent(rootDir, agent)
		scriptPath := HookScriptPathForAgent(rootDir, agent)
		if configPath != nil {
			addTarget(*configPath)
		}
		if scriptPath != nil {
			addTarget(*scriptPath)
		}
	}

	return targets
}
