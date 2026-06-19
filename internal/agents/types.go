package agents

type AgentType string

const (
	AgentCodex      AgentType = "codex"
	AgentClaude     AgentType = "claude"
	AgentCursor     AgentType = "cursor"
	AgentGoose      AgentType = "goose"
	AgentPi         AgentType = "pi"
	AgentGemini     AgentType = "gemini"
	AgentOpencode   AgentType = "opencode"
	AgentAider      AgentType = "aider"
	AgentCopilot    AgentType = "copilot"
	AgentTrae       AgentType = "trae"
	AgentClaw       AgentType = "claw"
	AgentDroid      AgentType = "droid"
	AgentHermes     AgentType = "hermes"
	AgentAntigravity AgentType = "antigravity"
	AgentKiro       AgentType = "kiro"
	AgentVscode     AgentType = "vscode"
	AgentKilo       AgentType = "kilo"
	AgentAmp        AgentType = "amp"
	AgentAugment    AgentType = "augment"
	AgentAdal       AgentType = "adal"
	AgentBob        AgentType = "bob"
	AgentCline      AgentType = "cline"
	AgentCodebuddy  AgentType = "codebuddy"
	AgentCommandCode AgentType = "command-code"
	AgentContinue   AgentType = "continue"
	AgentCortex     AgentType = "cortex"
	AgentCrush      AgentType = "crush"
	AgentDeepagents AgentType = "deepagents"
	AgentDevin      AgentType = "devin"
	AgentFirebender AgentType = "firebender"
	AgentIflow      AgentType = "iflow"
	AgentJunie      AgentType = "junie"
	AgentKiloCode   AgentType = "kilo-code"
	AgentKimi       AgentType = "kimi"
	AgentKode       AgentType = "kode"
	AgentMcpjam     AgentType = "mcpjam"
	AgentMistralVibe AgentType = "mistral-vibe"
	AgentMux        AgentType = "mux"
	AgentNeovate    AgentType = "neovate"
	AgentOpenclaw   AgentType = "openclaw"
	AgentOpenhands  AgentType = "openhands"
	AgentPochi      AgentType = "pochi"
	AgentQoder      AgentType = "qoder"
	AgentQwenCode   AgentType = "qwen-code"
	AgentReplit     AgentType = "replit"
	AgentRooCode    AgentType = "roo-code"
	AgentTraeCn     AgentType = "trae-cn"
	AgentWarp       AgentType = "warp"
	AgentWindsurf   AgentType = "windsurf"
	AgentZencoder   AgentType = "zencoder"
)

type InstallAgentOptions struct {
	Hook       *bool   `json:"hook,omitempty"`
	Scope      *string `json:"scope,omitempty"` // "project" | "user"
	Mcp        *bool   `json:"mcp,omitempty"`
	GraphFirst *string `json:"graphFirst,omitempty"` // "deny" | "context" | "off"
}

type InstallAgentResult struct {
	Agent   AgentType `json:"agent"`
	Target  string    `json:"target"`
	Targets []string  `json:"targets"`
	Warnings []string `json:"warnings,omitempty"`
	Notices  []string `json:"notices,omitempty"`
}

type AgentInstallTargetStatus struct {
	Path   string `json:"path"`
	Exists bool   `json:"exists"`
}

type AgentInstallStatus struct {
	Agent     AgentType                  `json:"agent"`
	Scope     string                     `json:"scope"`
	Hook      bool                       `json:"hook"`
	Installed bool                       `json:"installed"`
	Target    string                     `json:"target"`
	Targets   []AgentInstallTargetStatus `json:"targets"`
}
