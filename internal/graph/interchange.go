package graph

import (
	"fmt"
	"swarmvault-native/internal/types"
)

func ExportHyperedgeNodeId(hyperedge types.GraphHyperedge) string {
	return fmt.Sprintf("hyperedge:%s", hyperedge.ID)
}
