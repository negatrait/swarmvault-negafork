package graph

import (
	"sort"
	"strings"
	"swarmvault-native/internal/types"
)

func SortedFallbackHubs(graph types.GraphArtifact) []types.GraphNode {
	filtered := []types.GraphNode{}
	for _, node := range graph.Nodes {
		if node.Type != "source" {
			filtered = append(filtered, node)
		}
	}

	sort.SliceStable(filtered, func(i, j int) bool {
		left := filtered[i]
		right := filtered[j]

		leftDegree := 0
		if left.Degree != nil {
			leftDegree = *left.Degree
		}
		rightDegree := 0
		if right.Degree != nil {
			rightDegree = *right.Degree
		}
		if rightDegree != leftDegree {
			return rightDegree < leftDegree
		}

		leftBridgeScore := 0.0
		if left.BridgeScore != nil {
			leftBridgeScore = *left.BridgeScore
		}
		rightBridgeScore := 0.0
		if right.BridgeScore != nil {
			rightBridgeScore = *right.BridgeScore
		}
		if rightBridgeScore != leftBridgeScore {
			return rightBridgeScore < leftBridgeScore
		}

		leftLabel := ""
		if left.Label != nil {
			leftLabel = *left.Label
		}
		rightLabel := ""
		if right.Label != nil {
			rightLabel = *right.Label
		}
		return strings.Compare(leftLabel, rightLabel) < 0
	})

	if len(filtered) > 5 {
		return filtered[:5]
	}
	return filtered
}
