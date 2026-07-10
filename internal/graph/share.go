package graph

import (
	"sort"
	"strings"
	"swarmvault-native/internal/types"
)

func SortedFallbackHubs(graph types.GraphArtifact) []types.GraphNode {
	var filtered []types.GraphNode
	for _, node := range graph.Nodes {
		if node.Type != "source" {
			filtered = append(filtered, node)
		}
	}

	sort.SliceStable(filtered, func(i, j int) bool {
		left := filtered[i]
		right := filtered[j]

		rightDegree := 0
		if right.Degree != nil {
			rightDegree = *right.Degree
		}
		leftDegree := 0
		if left.Degree != nil {
			leftDegree = *left.Degree
		}

		if rightDegree != leftDegree {
			return rightDegree < leftDegree // Descending
		}

		rightScore := 0.0
		if right.BridgeScore != nil {
			rightScore = *right.BridgeScore
		}
		leftScore := 0.0
		if left.BridgeScore != nil {
			leftScore = *left.BridgeScore
		}

		if rightScore != leftScore {
			return rightScore < leftScore // Descending
		}

		leftLabel := ""
		if left.Label != nil {
			leftLabel = *left.Label
		}
		rightLabel := ""
		if right.Label != nil {
			rightLabel = *right.Label
		}

		return strings.Compare(leftLabel, rightLabel) < 0 // Ascending
	})

	limit := 5
	if len(filtered) < limit {
		limit = len(filtered)
	}

	if limit == 0 {
		return make([]types.GraphNode, 0)
	}

	return filtered[:limit]
}
