package agents

import (
	"fmt"
	"os"
	"path/filepath"
	"swarmvault-native/internal/utils"
)

const agentCodex = "codex"
const agentGemini = "gemini"
const agentOpencode = "opencode"
const agentCopilot = "copilot"
const agentKilo = "kilo"
const agentAgents = "agents"
const agentAntigravity = "antigravity"
const agentAider = "aider"
const agentDevin = "devin"
const agentKimi = "kimi"
const agentAmp = "amp"
const agentKiro = "kiro"
const agentClaude = "claude"
const agentHermes = "hermes"
const scopeUser = "user"

var agentFileKinds = map[string]string{
	agentAgents:           "AGENTS.md",
	agentClaude:           "CLAUDE.md",
	agentGemini:           "GEMINI.md",
	"cursor":              ".cursor/rules/swarmvault.mdc",
	agentAider:            "CONVENTIONS.md",
	agentCopilot:          ".github/copilot-instructions.md",
	"trae":                ".trae/rules/swarmvault.md",
	"claw":                ".claw/skills/swarmvault/SKILL.md",
	"droid":               ".factory/rules/swarmvault.md",
	agentKiro:             ".kiro/skills/swarmvault/SKILL.md",
	"kiroSteering":        ".kiro/steering/swarmvault.md",
	"antigravityRules":    ".agents/rules/swarmvault.md",
	"antigravityWorkflow": ".agents/workflows/swarmvault.md",
	"devinRules":          ".windsurf/rules/swarmvault.md",
	"vscode":              ".github/chatmodes/swarmvault.chatmode.md",
}

var PROJECT_SKILL_TARGETS = map[AgentType][]string{
	agentAntigravity: {".agents/skills"},
	agentAmp:         {".amp/skills"},
	agentClaude:      {".claude/skills"},
	agentCodex:       {".agents/skills"},
	agentCopilot:     {".copilot/skills"},
	agentDevin:       {".devin/skills"},
	agentGemini:      {".gemini/skills"},
	agentKimi:        {".kimi/skills"},
	agentOpencode:    {".opencode/skills"},
	"pi":             {".pi/agent/skills"},
}

var USER_SKILL_TARGETS = map[AgentType]string{
	agentAntigravity: filepath.Join(".gemini", "config", "skills"),
	agentAmp:         filepath.Join(".amp", "skills"),
	agentClaude:      filepath.Join(".claude", "skills"),
	agentCodex:       filepath.Join(".codex", "skills"),
	agentCopilot:     filepath.Join(".copilot", "skills"),
	agentDevin:       filepath.Join(".config", agentDevin, "skills"),
	agentGemini:      filepath.Join(".gemini", "skills"),
	agentKimi:        filepath.Join(".kimi", "skills"),
	agentKilo:        filepath.Join(".config", agentKilo, "skills"),
	agentOpencode:    filepath.Join(".config", agentOpencode, "skills"),
}

var SKILL_BUNDLE_AGENTS = map[AgentType]string{
	agentAmp:       ".config/agents/skills",
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
	if agent == agentHermes {
		return scopeUser
	}
	return "project"
}

func userHomeDir() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return homeDir
}

func hermesUserSkillPath() string {
	return filepath.Join(userHomeDir(), hermesUserSkillRelative)
}

func kiloUserCommandPath() string {
	return filepath.Join(userHomeDir(), ".config", agentKilo, "command", "swarmvault.md")
}

func claudeUserSettingsPath() string {
	return filepath.Join(userHomeDir(), ".claude", "settings.json")
}

func claudeUserHookScriptPath() string {
	return filepath.Join(userHomeDir(), ".claude", "hooks", "swarmvault-graph-first.js")
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
		path := skillBundlePath(userHomeDir(), relativeSkillsDir)
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
	return agent == agentCodex || agent == agentClaude || agent == agentOpencode || agent == agentGemini || agent == agentCopilot || agent == agentKilo
}

func hookScriptPathForAgent(rootDir string, agent AgentType) *string {
	var path string
	switch agent {
	case agentCodex:
		path = filepath.Join(rootDir, ".codex", "hooks", "swarmvault-graph-first.js")
	case agentClaude:
		path = filepath.Join(rootDir, ".claude", "hooks", "swarmvault-graph-first.js")
	case agentOpencode:
		path = filepath.Join(rootDir, ".opencode", "plugins", "swarmvault-graph-first.js")
	case agentKilo:
		path = filepath.Join(rootDir, ".kilo", "plugins", "swarmvault.js")
	case agentGemini:
		path = filepath.Join(rootDir, ".gemini", "hooks", "swarmvault-graph-first.js")
	case agentCopilot:
		path = filepath.Join(rootDir, ".github", "hooks", "swarmvault-graph-first.js")
	default:
		return nil
	}
	return &path
}

func hookConfigPathForAgent(rootDir string, agent AgentType) *string {
	var path string
	switch agent {
	case agentCodex:
		path = filepath.Join(rootDir, ".codex", "hooks.json")
	case agentClaude:
		path = filepath.Join(rootDir, ".claude", "settings.json")
	case agentGemini:
		path = filepath.Join(rootDir, ".gemini", "settings.json")
	case agentOpencode:
		path = filepath.Join(rootDir, ".opencode", "opencode.json")
	case agentKilo:
		path = filepath.Join(rootDir, ".kilo", "kilo.json")
	case agentCopilot:
		path = filepath.Join(rootDir, ".github", "hooks", "swarmvault-graph-first.json")
	default:
		return nil
	}
	return &path
}

func primaryTargetPathForAgent(rootDir string, agent AgentType, options InstallAgentOptions) (string, error) {
	if installScope(agent, options) == scopeUser {
		if agent == agentHermes {
			return hermesUserSkillPath(), nil
		}
		target := userSkillTarget(agent)
		if target != nil {
			return *target, nil
		}
	}

	switch agent {
	case agentKilo, agentCodex, "goose", "pi", agentOpencode:
		return filepath.Join(rootDir, agentFileKinds[agentAgents]), nil
	case agentClaude:
		return filepath.Join(rootDir, agentFileKinds[agentClaude]), nil
	case agentGemini:
		return filepath.Join(rootDir, agentFileKinds[agentGemini]), nil
	case "cursor":
		return filepath.Join(rootDir, agentFileKinds["cursor"]), nil
	case agentAider:
		return filepath.Join(rootDir, agentFileKinds[agentAider]), nil
	case agentCopilot:
		return filepath.Join(rootDir, agentFileKinds[agentCopilot]), nil
	case "trae":
		return filepath.Join(rootDir, agentFileKinds["trae"]), nil
	case "claw":
		return filepath.Join(rootDir, agentFileKinds["claw"]), nil
	case "droid":
		return filepath.Join(rootDir, agentFileKinds["droid"]), nil
	case agentKiro:
		return filepath.Join(rootDir, agentFileKinds[agentKiro]), nil
	case agentHermes:
		return hermesUserSkillPath(), nil
	case agentAntigravity:
		return filepath.Join(rootDir, agentFileKinds["antigravityRules"]), nil
	case "vscode":
		return filepath.Join(rootDir, agentFileKinds["vscode"]), nil
	default:
		bundleTarget := skillBundleTarget(rootDir, agent)
		if bundleTarget != nil {
			return *bundleTarget, nil
		}
		return "", fmt.Errorf("Unsupported agent %s", agent)
	}
}

func targetsForAgent(rootDir string, agent AgentType, options InstallAgentOptions) ([]string, error) {
	scope := installScope(agent, options)
	primaryTarget, err := primaryTargetPathForAgent(rootDir, agent, options)
	if err != nil {
		return nil, err
	}
	targets := []string{primaryTarget}

	if scope == scopeUser {
		if agent == agentKilo {
			targets = append(targets, kiloUserCommandPath())
		}
		if agent == agentHermes {
			targets = append(targets, filepath.Join(rootDir, agentFileKinds[agentAgents]))
		}
		if agent == agentClaude && options.Hook != nil && *options.Hook {
			targets = append(targets, claudeUserSettingsPath(), claudeUserHookScriptPath())
		}
		return utils.UniqueStrings(targets), nil
	}

	if agent == agentClaude && options.Mcp != nil && *options.Mcp {
		targets = append(targets, filepath.Join(rootDir, ".mcp.json"))
	}

	if options.Scope == "project" {
		targets = append(targets, projectSkillTargets(rootDir, agent)...)
	}

	if agent == agentCopilot {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds[agentAgents]))
	}

	if agent == "vscode" {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds[agentCopilot]))
	}

	if agent == agentAider {
		targets = append(targets, filepath.Join(rootDir, ".aider.conf.yml"))
	}

	if agent == agentKiro {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds["kiroSteering"]))
	}

	if agent == agentHermes {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds[agentAgents]))
	}

	if agent == agentAntigravity {
		targets = append(targets, filepath.Join(rootDir, agentFileKinds["antigravityWorkflow"]))
	}

	if agent == agentDevin {
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

	return utils.UniqueStrings(targets), nil
}
