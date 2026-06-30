package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/graph"
	"swarmvault-native/internal/types"
	"swarmvault-native/internal/utils"
)

func HandleGraph() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "exportHyperedgeNodeId":
		var args struct {
			Hyperedge types.GraphHyperedge `json:"hyperedge"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.ExportHyperedgeNodeId(args.Hyperedge)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown graph action: %s", payload.Action)
	}

	return nil
}
