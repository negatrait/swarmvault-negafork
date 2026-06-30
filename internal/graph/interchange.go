package graph

import (
	"fmt"
	"swarmvault-native/internal/types"
)

// ExportHyperedgeNodeId generates a standardized node ID for a hyperedge
func ExportHyperedgeNodeId(hyperedge types.GraphHyperedge) string {
	return fmt.Sprintf("hyperedge:%s", hyperedge.ID)
}
