package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/graph"
	"swarmvault-native/internal/types"
	"swarmvault-native/internal/utils"
)

func HandleGraph() error {
	var payload utils.ActionPayload
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
	case "buildViewerGraphArtifact":
		var args struct {
			Graph   types.GraphArtifact `json:"graph"`
			Options graph.Options       `json:"options"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.BuildViewerGraphArtifact(args.Graph, args.Options)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	case "sortedFallbackHubs":
		var args struct {
			Graph types.GraphArtifact `json:"graph"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.SortedFallbackHubs(args.Graph)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown graph action: %s", payload.Action)
	}

	return nil
}
