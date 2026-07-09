package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/hooks"
	"swarmvault-native/internal/utils"
)

func HandleHookState() error {
	var payload utils.ActionPayload
	if err := utils.DecodePayload(&payload); err != nil {
		return err
	}

	if payload.Action == "readWatchStaleness" {
		var args struct {
			Cwd string `json:"cwd"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return err
		}
		result, err := hooks.ReadWatchStaleness(args.Cwd)
		if err != nil {
			return err
		}
		return utils.EncodeResponse(result)
	}

	return fmt.Errorf("unknown hook-state action: %s", payload.Action)
}
