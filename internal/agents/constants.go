package agents

import (
	"path/filepath"
	"strings"
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

var legacyAntigravityFileKinds = map[string]string{
	"antigravityRules":    ".agent/rules/swarmvault.md",
	"antigravityWorkflow": ".agent/workflows/swarmvault.md",
}

var SKILL_BUNDLE_AGENTS = map[string]string{
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
	"vscode":      {".copilot/skills"},
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
	"pi":          filepath.Join(".pi", "agent", "skills"),
	"vscode":      filepath.Join(".copilot", "skills"),
}

var SWARMVAULT_RULE_BULLETS = []string{
	"- Read `swarmvault.schema.md` before compile or query style work. It is the canonical schema path.",
	"- Treat `raw/` as immutable source input.",
	"- Treat `wiki/` as generated markdown owned by the agent and compiler workflow.",
	"- If `SWARMVAULT_OUT` is set, resolve generated artifact paths like `raw/`, `wiki/`, and `state/` under that directory.",
	"- Read `wiki/graph/report.md` before broad file searching when it exists; otherwise start with `wiki/index.md`.",
	"- For code and graph questions (where is X, what calls Y, structure, impact), prefer `swarmvault graph query`, `swarmvault graph path`, and `swarmvault graph explain` over broad grep/glob searching; read source files directly only when editing them or when the graph lacks detail.",
	"- Preserve frontmatter fields including `page_id`, `source_ids`, `node_ids`, `freshness`, and `source_hashes`.",
	"- When asked for durable research, reviews, or handoff artifacts, save the answer into `wiki/outputs/`; answer quick questions directly in chat without writing files.",
	"- Prefer `swarmvault ingest`, `swarmvault compile`, `swarmvault query`, and `swarmvault lint` for SwarmVault maintenance tasks.",
}

var PRE_GRAPH_FIRST_BULLET = "- For graph questions, prefer `swarmvault graph query`, `swarmvault graph path`, and `swarmvault graph explain` before broad grep/glob searching."
var PRE_GRAPH_FIRST_SAVE_BULLET = "- Save high-value answers back into `wiki/outputs/` instead of leaving them only in chat."

var PRE_GRAPH_FIRST_RULE_BULLETS = func() []string {
	var result []string
	for _, bullet := range SWARMVAULT_RULE_BULLETS {
		if strings.HasPrefix(bullet, "- For code and graph questions") {
			result = append(result, PRE_GRAPH_FIRST_BULLET)
		} else if strings.HasPrefix(bullet, "- When asked for durable research") {
			result = append(result, PRE_GRAPH_FIRST_SAVE_BULLET)
		} else {
			result = append(result, bullet)
		}
	}
	return result
}()

var LEGACY_SWARMVAULT_RULE_BULLETS = func() []string {
	var result []string
	for _, bullet := range PRE_GRAPH_FIRST_RULE_BULLETS {
		if !strings.Contains(bullet, "SWARMVAULT_OUT") {
			result = append(result, bullet)
		}
	}
	return result
}()

const managedStart = "<!-- swarmvault:managed:start -->"
const managedEnd = "<!-- swarmvault:managed:end -->"
const legacyManagedStart = "<!-- vault:managed:start -->"
const legacyManagedEnd = "<!-- vault:managed:end -->"

const copilotHookVersion = 1

var claudePreToolUseMatchers = []string{"Grep|Glob", "Bash"}
var claudePostEditMatcher = "Edit|Write|MultiEdit|NotebookEdit"
var claudeSessionMatchers = []string{"startup", "resume", "clear", "compact"}

var geminiSessionMatcher = "startup"
var geminiSearchMatcher = "glob|grep|search|find"
var codexSearchMatcher = "Bash"
