package graph

import (
	"encoding/json"
	"os"
	"path/filepath"
	"swarmvault-native/internal/types"
	"testing"
)

func TestExportHyperedgeNodeId(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "packages", "engine", "test", "shared-fixtures", "hyperedge.json")
	bytes, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("Failed to read fixture: %v", err)
	}

	var hyperedge types.GraphHyperedge
	if err := json.Unmarshal(bytes, &hyperedge); err != nil {
		t.Fatalf("Failed to unmarshal fixture: %v", err)
	}

	result := ExportHyperedgeNodeId(hyperedge)
	expected := "hyperedge:test-hyperedge-123"

	if result != expected {
		t.Errorf("Expected %s, got %s", expected, result)
	}
}
