package cmd

import (
	"encoding/json"
	"fmt"
	"time"

	"swarmvault-native/internal/freshness"
	"swarmvault-native/internal/types"
	"swarmvault-native/internal/utils"
)

type freshnessArgs struct {
	Pages  []types.GraphPage `json:"pages"`
	Config types.DecayConfig `json:"config"`
	Now    string            `json:"now"`
}

func HandleFreshness() error {
	var payload utils.ActionPayload
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "applyDecayToPages":
		var args freshnessArgs
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding applyDecayToPages args: %w", err)
		}

		now, err := time.Parse(time.RFC3339Nano, args.Now)
		if err != nil {
			now, err = time.Parse(time.RFC3339, args.Now)
			if err != nil {
				now = time.Now()
			}
		}

		resolvedConfig := freshness.ResolveDecayConfig(&args.Config)
		result := freshness.ApplyDecayToPages(args.Pages, resolvedConfig, now)
		return utils.EncodeResponse(result)
	default:
		return fmt.Errorf("unknown freshness action: %s", payload.Action)
	}
}
