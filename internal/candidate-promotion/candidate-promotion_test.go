package candidatepromotion

import "swarmvault-native/internal/utils"

import (
	"testing"
	"time"
)

func TestHoursSince(t *testing.T) {
	iso := "2023-10-01T12:00:00Z"
	then, _ := time.Parse(time.RFC3339, iso)
	now := then.Add(24 * time.Hour).UnixMilli()

	hours := hoursSince(iso, now)
	if hours != 24 {
		t.Errorf("Expected 24 hours, got %f", hours)
	}
}

func TestJaccard(t *testing.T) {
	left := []string{"a", "b", "c"}
	right := []string{"b", "c", "d"}
	res := utils.Jaccard(left, right)

	// union: a,b,c,d (4)
	// intersect: b,c (2)
	// res = 0.5
	if res != 0.5 {
		t.Errorf("Expected 0.5, got %f", res)
	}
}

func TestEvaluateCandidateForPromotion(t *testing.T) {
	iso := "2023-10-01T12:00:00Z"
	then, _ := time.Parse(time.RFC3339, iso)
	now := then.Add(25 * time.Hour).UnixMilli()

	page := GraphPage{
		ID:         "page-1",
		Title:      "Test Page",
		Kind:       "concept",
		SourceIds:  []string{"s1", "s2", "s3"},
		NodeIds:    []string{"n1"},
		Confidence: 0.85,
		CreatedAt:  iso,
	}

	degree2 := 2
	graph := GraphArtifact{
		Nodes: []GraphNode{
			{ID: "n1", Degree: &degree2},
		},
	}

	history := map[string]CandidateHistoryEntry{
		"page-1": {
			SourceIds: []string{"s1", "s2", "s3"},
			Status:    "candidate",
		},
	}

	config := CandidatePromotionConfig{
		Enabled:       true,
		MinSources:    3,
		MinConfidence: 0.8,
		MinAgreement:  0.7,
		MinDegree:     2,
		MinAgeHours:   24,
	}

	decision := EvaluateCandidateForPromotion(page, graph, history, config, now)

	if !decision.Promote {
		t.Errorf("Expected candidate to be promoted")
	}

	if decision.Score != 1.0 {
		t.Errorf("Expected score 1.0, got %f", decision.Score)
	}

	if len(decision.Gates) != 5 {
		t.Errorf("Expected 5 gates, got %d", len(decision.Gates))
	}
}

func TestSortDecisionsForPromotion(t *testing.T) {
	decisions := []PromotionDecision{
		{PageID: "b", Promote: true, Score: 0.8},
		{PageID: "a", Promote: false, Score: 0.6},
		{PageID: "c", Promote: true, Score: 0.9},
		{PageID: "d", Promote: true, Score: 0.8},
	}

	sorted := SortDecisionsForPromotion(decisions)

	// Expected order:
	// 1. Promote=true, Score=0.9, PageID="c"
	// 2. Promote=true, Score=0.8, PageID="b"
	// 3. Promote=true, Score=0.8, PageID="d"
	// 4. Promote=false, Score=0.6, PageID="a"
	expectedIDs := []string{"c", "b", "d", "a"}

	for i, id := range expectedIDs {
		if sorted[i].PageID != id {
			t.Errorf("Expected sorted[%d] to be %s, got %s", i, id, sorted[i].PageID)
		}
	}
}
