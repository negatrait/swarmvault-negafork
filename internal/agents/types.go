package agents

type AgentType string

type InstallAgentOptions struct {
	Hook       *bool  `json:"hook,omitempty"`
	Scope      string `json:"scope,omitempty"`
	Mcp        *bool  `json:"mcp,omitempty"`
	GraphFirst string `json:"graphFirst,omitempty"`
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
