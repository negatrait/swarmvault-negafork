package cmd

import (
	"encoding/json"
	"fmt"

	"swarmvault-native/internal/graph"
	"swarmvault-native/internal/types"
	"swarmvault-native/internal/utils"
)

type graphPayload struct {
	Hyperedge types.GraphHyperedge `json:"hyperedge"`
}

func HandleGraph() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}

	if err := utils.DecodePayload(&payload); err != nil {
		return err
	}

	switch payload.Action {
	case "exportHyperedgeNodeId":
		var args graphPayload
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("failed to decode args for exportHyperedgeNodeId: %v", err)
		}
		result := graph.ExportHyperedgeNodeId(args.Hyperedge)
		return utils.EncodeResponse(result)
	default:
		return fmt.Errorf("unknown action: %s", payload.Action)
	}
}
