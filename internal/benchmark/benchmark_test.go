package benchmark

import (
	"testing"
)

func TestEstimateTokens(t *testing.T) {
	if EstimateTokens("") != 1 {
		t.Errorf("Expected 1 token for empty string")
	}
	if EstimateTokens("1234") != 1 {
		t.Errorf("Expected 1 token for 4 chars")
	}
	if EstimateTokens("12345") != 2 {
		t.Errorf("Expected 2 tokens for 5 chars")
	}
}

func TestEstimateCorpusWords(t *testing.T) {
	texts := []string{
		"Hello world",
		"  This is a   test  ",
		"",
	}
	words := EstimateCorpusWords(texts)
	if words != 6 {
		t.Errorf("Expected 6 words, got %d", words)
	}
}

func TestGraphHash(t *testing.T) {
	g := GraphArtifact{
		Pages: []GraphPage{
			{ID: "p1", Kind: "source"},
			{ID: "p2", Kind: "graph_report"},
		},
		Nodes: []GraphNode{
			{ID: "n1", Label: "A", SourceIDs: []string{"s2", "s1"}, ProjectIDs: []string{}},
		},
	}
	h1 := GraphHash(g)

	g2 := GraphArtifact{
		Pages: []GraphPage{
			{ID: "p1", Kind: "source"},
		},
		Nodes: []GraphNode{
			{ID: "n1", Label: "A", SourceIDs: []string{"s1", "s2"}, ProjectIDs: []string{}},
		},
	}
	h2 := GraphHash(g2)

	if h1 != h2 {
		t.Errorf("Expected hashes to be equal since sourceIds sorting and skipping graph_report should happen. Got %s and %s", h1, h2)
	}
}
