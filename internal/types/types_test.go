package types

import (
	"encoding/json"
	"testing"
)

func TestGraphNodeSerialization(t *testing.T) {
	label := "test-label"
	degree := 5
	centrality := 0.75

	node := GraphNode{
		ID:         "node-1",
		Type:       "page",
		Name:       "Test Node",
		Label:      &label,
		Degree:     &degree,
		Centrality: &centrality,
	}

	data, err := json.Marshal(node)
	if err != nil {
		t.Fatalf("failed to marshal GraphNode: %v", err)
	}

	var decoded GraphNode
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("failed to unmarshal GraphNode: %v", err)
	}

	if decoded.ID != node.ID || decoded.Type != node.Type || decoded.Name != node.Name {
		t.Errorf("unmarshaled node mismatch: %+v vs %+v", decoded, node)
	}

	if decoded.Label == nil || *decoded.Label != *node.Label {
		t.Errorf("unmarshaled node Label mismatch")
	}

	if decoded.Degree == nil || *decoded.Degree != *node.Degree {
		t.Errorf("unmarshaled node Degree mismatch")
	}

	if decoded.Centrality == nil || *decoded.Centrality != *node.Centrality {
		t.Errorf("unmarshaled node Centrality mismatch")
	}
}

func TestSourceClaimSerialization(t *testing.T) {
	claim := SourceClaim{
		ID:         "claim-1",
		Text:       "test claim text",
		Confidence: 0.99,
		Status:     ClaimStatusExtracted,
		Polarity:   PolarityPositive,
		Citation:   "source.md",
	}

	data, err := json.Marshal(claim)
	if err != nil {
		t.Fatalf("failed to marshal SourceClaim: %v", err)
	}

	var decoded SourceClaim
	err = json.Unmarshal(data, &decoded)
	if err != nil {
		t.Fatalf("failed to unmarshal SourceClaim: %v", err)
	}

	if decoded.ID != claim.ID || decoded.Text != claim.Text || decoded.Confidence != claim.Confidence ||
		decoded.Status != claim.Status || decoded.Polarity != claim.Polarity || decoded.Citation != claim.Citation {
		t.Errorf("unmarshaled claim mismatch: %+v vs %+v", decoded, claim)
	}
}
