package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/graph"
	"swarmvault-native/internal/types"
	"swarmvault-native/internal/utils"
)

type GraphPayload struct {
	Action string          `json:"action"`
	Args   json.RawMessage `json:"args"`
}

func HandleGraph() error {
	var payload GraphPayload
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

	case "relationType":
		var args struct {
			Relation string `json:"relation"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.RelationType(args.Relation)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "cypherStringLiteral":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.CypherStringLiteral(args.Value)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "graphPageById":
		var args struct {
			Graph types.GraphArtifact `json:"graph"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.GraphPageById(args.Graph)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "graphNodeById":
		var args struct {
			Graph types.GraphArtifact `json:"graph"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.GraphNodeById(args.Graph)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "normalizeSwarmNodeProps":
		var args struct {
			Node types.GraphNode  `json:"node"`
			Page *types.GraphPage `json:"page"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.NormalizeSwarmNodeProps(args.Node, args.Page)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "normalizeHyperedgeNodeProps":
		var args struct {
			Hyperedge types.GraphHyperedge `json:"hyperedge"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.NormalizeHyperedgeNodeProps(args.Hyperedge)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "normalizeEdgeProps":
		var args struct {
			Edge types.GraphEdge `json:"edge"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.NormalizeEdgeProps(args.Edge)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "normalizeGroupMemberProps":
		var args struct {
			Hyperedge types.GraphHyperedge `json:"hyperedge"`
			NodeId    string               `json:"nodeId"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.NormalizeGroupMemberProps(args.Hyperedge, args.NodeId)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "filterGraphBySourceClasses":
		var args struct {
			Graph          types.GraphArtifact `json:"graph"`
			IncludeClasses []types.SourceClass `json:"includeClasses"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.FilterGraphBySourceClasses(args.Graph, args.IncludeClasses)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "graphCounts":
		var args struct {
			Graph types.GraphArtifact `json:"graph"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := graph.GraphCounts(args.Graph)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	default:
		return fmt.Errorf("unknown graph action: %s", payload.Action)
	}

	return nil
}
