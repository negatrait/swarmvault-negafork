package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/config"
	"swarmvault-native/internal/utils"
)

func HandleConfig() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "resolveLargeRepoDefaults":
		var args config.ResolveLargeRepoDefaultsInput
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := config.ResolveLargeRepoDefaults(args)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
		return nil
	default:
		return fmt.Errorf("unknown config action: %s", payload.Action)
	}
}
