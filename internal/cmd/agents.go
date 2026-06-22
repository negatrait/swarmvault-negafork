package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"swarmvault-native/internal/agents"
)

func HandleAgents() {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := json.NewDecoder(os.Stdin).Decode(&payload); err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
		os.Exit(1)
	}

	switch payload.Action {
	case "getAgentInstallStatus":
		var args struct {
			RootDir string                     `json:"rootDir"`
			Agent   agents.AgentType           `json:"agent"`
			Options agents.InstallAgentOptions `json:"options"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := agents.GetAgentInstallStatus(args.RootDir, args.Agent, args.Options)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting agent install status: %v\n", err)
			os.Exit(1)
		}
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown agents action: %s\n", payload.Action)
		os.Exit(1)
	}
}
