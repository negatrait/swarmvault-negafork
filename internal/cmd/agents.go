package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/agents"
	"swarmvault-native/internal/utils"
)

func HandleAgents() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "getAgentInstallStatus":
		var args struct {
			RootDir string                     `json:"rootDir"`
			Agent   agents.AgentType           `json:"agent"`
			Options agents.InstallAgentOptions `json:"options"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := agents.GetAgentInstallStatus(args.RootDir, args.Agent, args.Options)
		if err != nil {
			return fmt.Errorf("error getting agent install status: %w", err)
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	default:
		return fmt.Errorf("unknown agents action: %s", payload.Action)
	}

	return nil
}
