package cmd

import (
	"encoding/json"
	"fmt"
	outputartifacts "swarmvault-native/internal/output-artifacts"
	"swarmvault-native/internal/utils"
)

func HandleOutputArtifacts() error {
	var payload utils.ActionPayload
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "renderChartSvg":
		var args struct {
			Spec outputartifacts.ChartSpec `json:"spec"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(outputartifacts.RenderChartSvg(args.Spec)); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown output-artifacts action: %s", payload.Action)
	}

	return nil
}
