package agents

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func fileExistsStatus(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

func GetAgentInstallStatus(rootDir string, agent AgentType, options *InstallAgentOptions) (*AgentInstallStatus, error) {
	target := PrimaryTargetPathForAgent(rootDir, agent, options)
	targets := TargetsForAgent(rootDir, agent, options)

	var targetStatuses []TargetStatus
	allInstalled := true

	for _, t := range targets {
		exists := fileExistsStatus(t)
		targetStatuses = append(targetStatuses, TargetStatus{
			Path:   t,
			Exists: exists,
		})
		if !exists {
			allInstalled = false
		}
	}

	hook := false
	if options != nil && options.Hook != nil {
		hook = *options.Hook
	}

	return &AgentInstallStatus{
		Agent:     agent,
		Scope:     InstallScope(agent, options),
		Hook:      hook,
		Target:    target,
		Targets:   targetStatuses,
		Installed: len(targetStatuses) > 0 && allInstalled,
	}, nil
}

func StableKeyForAgent(rootDir string, agent AgentType) string {
	if agent == "codex" || agent == "goose" || agent == "pi" {
		return "shared:" + filepath.Join(rootDir, AgentFileKinds["agents"])
	}

	options := &InstallAgentOptions{}
	hook := SupportsAgentHook(agent)
	options.Hook = &hook
	targets := TargetsForAgent(rootDir, agent, options)

	h := sha1.New()
	h.Write([]byte(strings.Join(targets, "\n")))
	hash := hex.EncodeToString(h.Sum(nil))

	return fmt.Sprintf("%s:%s", agent, hash)
}

// We aren't doing installAgent via go sidecar. But installConfiguredAgents needs it. We will not port installConfiguredAgents via bridge.
func InstallConfiguredAgents(rootDir string) ([]*InstallAgentResult, error) {
	return nil, nil
}
