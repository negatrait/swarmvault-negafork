package agents

type AgentType string

type InstallAgentOptions struct {
	Scope      *string `json:"scope,omitempty"`
	Hook       *bool   `json:"hook,omitempty"`
	Mcp        *bool   `json:"mcp,omitempty"`
	GraphFirst *string `json:"graphFirst,omitempty"` // "deny" | "context" | "off"
}

type InstallAgentResult struct {
	Agent    AgentType `json:"agent"`
	Target   string    `json:"target"`
	Targets  []string  `json:"targets"`
	Notices  []string  `json:"notices,omitempty"`
	Warnings []string  `json:"warnings,omitempty"`
}

type TargetStatus struct {
	Path   string `json:"path"`
	Exists bool   `json:"exists"`
}

type AgentInstallStatus struct {
	Agent     AgentType      `json:"agent"`
	Scope     string         `json:"scope"`
	Hook      bool           `json:"hook"`
	Target    string         `json:"target"`
	Targets   []TargetStatus `json:"targets"`
	Installed bool           `json:"installed"`
}

type JsonWarningResult[T any] struct {
	Data     T        `json:"data"`
	Warnings []string `json:"warnings"`
}

type ClaudeHookEntry struct {
	Matcher *string `json:"matcher,omitempty"`
	Hooks   *[]struct {
		Type    *string `json:"type,omitempty"`
		Command *string `json:"command,omitempty"`
	} `json:"hooks,omitempty"`
}

type ClaudeSettings struct {
	Hooks *struct {
		SessionStart *[]ClaudeHookEntry `json:"SessionStart,omitempty"`
		PreToolUse   *[]ClaudeHookEntry `json:"PreToolUse,omitempty"`
		PostToolUse  *[]ClaudeHookEntry `json:"PostToolUse,omitempty"`
	} `json:"hooks,omitempty"`
}

type McpConfig struct {
	McpServers map[string]struct {
		Command string   `json:"command,omitempty"`
		Args    []string `json:"args,omitempty"`
	} `json:"mcpServers,omitempty"`
}

type GeminiSettings struct {
	Hooks *struct {
		SessionStart *[]struct {
			Matcher *string `json:"matcher,omitempty"`
			Hooks   *[]struct {
				Name    *string `json:"name,omitempty"`
				Type    *string `json:"type,omitempty"`
				Command *string `json:"command,omitempty"`
			} `json:"hooks,omitempty"`
		} `json:"SessionStart,omitempty"`
		BeforeTool *[]struct {
			Matcher *string `json:"matcher,omitempty"`
			Hooks   *[]struct {
				Name    *string `json:"name,omitempty"`
				Type    *string `json:"type,omitempty"`
				Command *string `json:"command,omitempty"`
			} `json:"hooks,omitempty"`
		} `json:"BeforeTool,omitempty"`
	} `json:"hooks,omitempty"`
}

type CodexSettings struct {
	Hooks *struct {
		SessionStart *[]struct {
			Matcher *string `json:"matcher,omitempty"`
			Hooks   *[]struct {
				Type    *string `json:"type,omitempty"`
				Command *string `json:"command,omitempty"`
			} `json:"hooks,omitempty"`
		} `json:"SessionStart,omitempty"`
		PreToolUse *[]struct {
			Matcher *string `json:"matcher,omitempty"`
			Hooks   *[]struct {
				Type    *string `json:"type,omitempty"`
				Command *string `json:"command,omitempty"`
			} `json:"hooks,omitempty"`
		} `json:"PreToolUse,omitempty"`
	} `json:"hooks,omitempty"`
}

type CopilotHookConfig struct {
	Version *int `json:"version,omitempty"`
	Hooks   *struct {
		SessionStart *[]struct {
			Type       *string `json:"type,omitempty"`
			Bash       *string `json:"bash,omitempty"`
			Powershell *string `json:"powershell,omitempty"`
			Cwd        *string `json:"cwd,omitempty"`
			TimeoutSec *int    `json:"timeoutSec,omitempty"`
		} `json:"sessionStart,omitempty"`
		PreToolUse *[]struct {
			Matcher    *string `json:"matcher,omitempty"`
			Type       *string `json:"type,omitempty"`
			Bash       *string `json:"bash,omitempty"`
			Powershell *string `json:"powershell,omitempty"`
			Cwd        *string `json:"cwd,omitempty"`
			TimeoutSec *int    `json:"timeoutSec,omitempty"`
		} `json:"preToolUse,omitempty"`
	} `json:"hooks,omitempty"`
}

type PluginConfig struct {
	Plugins []string `json:"plugins,omitempty"`
}

type VaultConfig struct {
	Agents []AgentType `json:"agents"`
}
