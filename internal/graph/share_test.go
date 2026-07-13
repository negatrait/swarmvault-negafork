package graph

import (
	"encoding/json"
	"os"
	"swarmvault-native/internal/types"
	"testing"
)

func TestSortedFallbackHubs(t *testing.T) {
	data, err := os.ReadFile("../../packages/engine/test/shared-fixtures/graph-share.json")
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	var graph types.GraphArtifact
	if err := json.Unmarshal(data, &graph); err != nil {
		t.Fatalf("failed to unmarshal fixture: %v", err)
	}

	result := SortedFallbackHubs(graph)

	if len(result) != 5 {
		t.Fatalf("expected 5 nodes, got %d", len(result))
	}

	expectedLabels := []string{"Alpha", "Beta", "Zeta", "Delta", "Gamma"}
	for i, node := range result {
		if node.Label != expectedLabels[i] {
			t.Errorf("expected node %d to be %s, got %s", i, expectedLabels[i], node.Label)
		}
	}
}
