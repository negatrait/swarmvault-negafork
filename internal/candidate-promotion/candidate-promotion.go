package candidatepromotion

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"swarmvault-native/internal/utils"
)

type CandidatePromotionConfig struct {
	Enabled       bool    `json:"enabled"`
	MinSources    int     `json:"minSources"`
	MinConfidence float64 `json:"minConfidence"`
	MinAgreement  float64 `json:"minAgreement"`
	MinDegree     int     `json:"minDegree"`
	MinAgeHours   int     `json:"minAgeHours"`
	MaxPerRun     int     `json:"maxPerRun"`
	DryRun        bool    `json:"dryRun"`
}

var DEFAULT_PROMOTION_CONFIG = CandidatePromotionConfig{
	Enabled:       false,
	MinSources:    3,
	MinConfidence: 0.8,
	MinAgreement:  0.7,
	MinDegree:     2,
	MinAgeHours:   24,
	MaxPerRun:     25,
	DryRun:        false,
}

type PromotionGateKind string

type PromotionGateResult struct {
	Gate      PromotionGateKind `json:"gate"`
	Value     float64           `json:"value"`
	Threshold float64           `json:"threshold"`
	Passed    bool              `json:"passed"`
}

type PromotionDecision struct {
	PageID  string                `json:"pageId"`
	Title   string                `json:"title"`
	Kind    string                `json:"kind"` // "concept" | "entity"
	Promote bool                  `json:"promote"`
	Score   float64               `json:"score"`
	Gates   []PromotionGateResult `json:"gates"`
	Reasons []string              `json:"reasons"`
}

type PromotionSession struct {
	StartedAt       string              `json:"startedAt"`
	FinishedAt      string              `json:"finishedAt"`
	DryRun          bool                `json:"dryRun"`
	PromotedPageIds []string            `json:"promotedPageIds"`
	SkippedPageIds  []string            `json:"skippedPageIds"`
	Decisions       []PromotionDecision `json:"decisions"`
	SessionPath     *string             `json:"sessionPath,omitempty"`
}

func hoursSince(iso string, now int64) float64 {
	thenTime, err := time.Parse(time.RFC3339Nano, iso)
	if err != nil {
		// Try fallback just in case without nano
		thenTime, err = time.Parse(time.RFC3339, iso)
		if err != nil {
			return 0
		}
	}
	then := thenTime.UnixMilli()
	return math.Max(0, float64(now-then)/float64(1000*60*60))
}

// Minimal representations to satisfy signatures without duplicating huge types from benchmarking package
type GraphNode struct {
	ID     string `json:"id"`
	Degree *int   `json:"degree,omitempty"`
}

type GraphArtifact struct {
	Nodes []GraphNode `json:"nodes"`
}

func maxDegreeFor(graph GraphArtifact, nodeIds []string) int {
	best := 0
	byId := make(map[string]GraphNode)
	for _, node := range graph.Nodes {
		byId[node.ID] = node
	}
	for _, nodeId := range nodeIds {
		if node, ok := byId[nodeId]; ok {
			deg := 0
			if node.Degree != nil {
				deg = *node.Degree
			}
			if deg > best {
				best = deg
			}
		}
	}
	return best
}

func describeGate(result PromotionGateResult) string {
	verb := "<"
	if result.Passed {
		verb = ">="
	}
	return fmt.Sprintf("%s %.2f %s %.2f", result.Gate, result.Value, verb, result.Threshold)
}

type GraphPage struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	Kind       string   `json:"kind"`
	SourceIds  []string `json:"sourceIds"`
	NodeIds    []string `json:"nodeIds"`
	Confidence float64  `json:"confidence"`
	CreatedAt  string   `json:"createdAt"`
}

type CandidateHistoryEntry struct {
	SourceIds []string `json:"sourceIds"`
	Status    string   `json:"status"` // "candidate" | "active"
}

func EvaluateCandidateForPromotion(
	page GraphPage,
	graph GraphArtifact,
	history map[string]CandidateHistoryEntry,
	config CandidatePromotionConfig,
	now int64,
) PromotionDecision {
	var historicalSources []string
	if historical, ok := history[page.ID]; ok {
		historicalSources = historical.SourceIds
	} else {
		historicalSources = make([]string, 0)
	}

	agreement := 0.0
	if len(historicalSources) > 0 {
		agreement = utils.Jaccard(historicalSources, page.SourceIds)
	}

	degree := maxDegreeFor(graph, page.NodeIds)
	ageHours := hoursSince(page.CreatedAt, now)

	sourcesPassed := len(page.SourceIds) >= config.MinSources
	confidencePassed := page.Confidence >= config.MinConfidence
	agreementPassed := agreement >= config.MinAgreement
	degreePassed := degree >= config.MinDegree
	agePassed := ageHours >= float64(config.MinAgeHours)

	gates := []PromotionGateResult{
		{Gate: "sources", Value: float64(len(page.SourceIds)), Threshold: float64(config.MinSources), Passed: sourcesPassed},
		{Gate: "confidence", Value: page.Confidence, Threshold: config.MinConfidence, Passed: confidencePassed},
		{Gate: "agreement", Value: agreement, Threshold: config.MinAgreement, Passed: agreementPassed},
		{Gate: "degree", Value: float64(degree), Threshold: float64(config.MinDegree), Passed: degreePassed},
		{Gate: "age", Value: ageHours, Threshold: float64(config.MinAgeHours), Passed: agePassed},
	}

	passedCount := 0
	promote := true
	for _, gate := range gates {
		if gate.Passed {
			passedCount++
		} else {
			promote = false
		}
	}

	score := float64(passedCount) / float64(len(gates))

	reasons := make([]string, len(gates))
	for i, gate := range gates {
		reasons[i] = describeGate(gate)
	}

	return PromotionDecision{
		PageID:  page.ID,
		Title:   page.Title,
		Kind:    page.Kind,
		Promote: promote,
		Score:   score,
		Gates:   gates,
		Reasons: reasons,
	}
}

func SortDecisionsForPromotion(decisions []PromotionDecision) []PromotionDecision {
	sorted := make([]PromotionDecision, len(decisions))
	copy(sorted, decisions)

	sort.Slice(sorted, func(i, j int) bool {
		left := sorted[i]
		right := sorted[j]

		if left.Promote != right.Promote {
			return left.Promote
		}
		if right.Score != left.Score {
			return left.Score > right.Score // higher score comes first
		}
		return left.PageID < right.PageID
	})

	return sorted
}

func RenderPromotionSessionMarkdown(
	decisions []PromotionDecision,
	promotedPageIds []string,
	dryRun bool,
	startedAt string,
	finishedAt string,
) string {
	var lines []string
	lines = append(lines, "# Auto-Promotion Run")
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("- started: %s", startedAt))
	lines = append(lines, fmt.Sprintf("- finished: %s", finishedAt))

	mode := "applied"
	if dryRun {
		mode = "dry-run"
	}
	lines = append(lines, fmt.Sprintf("- mode: %s", mode))
	lines = append(lines, fmt.Sprintf("- promoted: %d", len(promotedPageIds)))
	lines = append(lines, fmt.Sprintf("- evaluated: %d", len(decisions)))
	lines = append(lines, "")
	lines = append(lines, "| page | decision | score | reasons |")
	lines = append(lines, "| --- | --- | --- | --- |")

	promotedMap := make(map[string]bool)
	for _, id := range promotedPageIds {
		promotedMap[id] = true
	}

	sortedDecisions := SortDecisionsForPromotion(decisions)
	for _, decision := range sortedDecisions {
		decided := "skipped"
		if decision.Promote {
			if promotedMap[decision.PageID] {
				decided = "promoted"
			} else {
				decided = "promote (dry-run)"
			}
		}
		lines = append(lines, fmt.Sprintf("| %s | %s | %.2f | %s |", decision.PageID, decided, decision.Score, strings.Join(decision.Reasons, "; ")))
	}
	lines = append(lines, "")
	return strings.Join(lines, "\n")
}
