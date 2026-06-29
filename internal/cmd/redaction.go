package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/redaction"
	"swarmvault-native/internal/utils"
)

func HandleRedaction() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "resolveRedactionPatterns":
		var args []json.RawMessage
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args array: %w", err)
		}

		var config *redaction.RedactionConfig
		if len(args) > 0 && string(args[0]) != "null" {
			if err := json.Unmarshal(args[0], &config); err != nil {
				return fmt.Errorf("error decoding RedactionConfig: %w", err)
			}
		}

		result, err := redaction.ResolveRedactionPatterns(config)
		if err != nil {
			return err
		}

		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown redaction action: %s", payload.Action)
	}

	return nil
}
