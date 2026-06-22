package agents

import (
	"os"
)

// fileExists is a simple internal stub to avoid porting utils.ts
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func GetAgentInstallStatus(rootDir string, agent AgentType, options InstallAgentOptions) (*AgentInstallStatus, error) {
	target := primaryTargetPathForAgent(rootDir, agent, options)
	targets := targetsForAgent(rootDir, agent, options)

	targetStatuses := make([]AgentInstallTargetStatus, 0, len(targets))
	allExist := true

	for _, t := range targets {
		exists := fileExists(t)
		targetStatuses = append(targetStatuses, AgentInstallTargetStatus{
			Path:   t,
			Exists: exists,
		})
		if !exists {
			allExist = false
		}
	}

	hook := false
	if options.Hook != nil {
		hook = *options.Hook
	}

	installed := len(targetStatuses) > 0 && allExist

	return &AgentInstallStatus{
		Agent:     agent,
		Scope:     installScope(agent, options),
		Hook:      hook,
		Target:    target,
		Targets:   targetStatuses,
		Installed: installed,
	}, nil
}
