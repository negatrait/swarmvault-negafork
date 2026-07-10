package cmd

import (
	"encoding/json"
	"fmt"

	"swarmvault-native/internal/findings"
	"swarmvault-native/internal/utils"
)

// HandleFindings dispatches finding-related commands.
func HandleFindings() error {
	var payload utils.ActionPayload

	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "normalizeFindingSeverity":
		var args struct {
			Value json.RawMessage `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("failed to unmarshal args: %w", err)
		}

		var strValue string
		if err := json.Unmarshal(args.Value, &strValue); err != nil {
			strValue = ""
		}
		result := findings.NormalizeFindingSeverity(strValue)
		return utils.EncodeResponse(result)
	default:
		return fmt.Errorf("unknown action: %s", payload.Action)
	}
}
