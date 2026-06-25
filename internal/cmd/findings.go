package cmd

import (
	"encoding/json"
	"fmt"

	"swarmvault-native/internal/findings"
	"swarmvault-native/internal/utils"
)

// HandleFindings dispatches finding-related commands.
func HandleFindings() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}

	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "normalizeFindingSeverity":
		var args struct {
			Value any `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("failed to unmarshal args: %w", err)
		}

		result := findings.NormalizeFindingSeverity(args.Value)
		return utils.EncodeResponse(result)
	default:
		return fmt.Errorf("unknown action: %s", payload.Action)
	}
}
