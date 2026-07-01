package benchmark

import (
	"math"
	"time"
)

type BuildBenchmarkByClassInput struct {
	Graph               GraphArtifact                             `json:"graph"`
	PerClassCorpusWords map[SourceClass]int                       `json:"perClassCorpusWords"`
	PerClassPerQuestion map[SourceClass][]BenchmarkQuestionResult `json:"perClassPerQuestion"`
}

func buildClassEntry(sourceClass SourceClass, input BuildBenchmarkByClassInput) BenchmarkByClassEntry {
	corpusWords := 0
	if cw, ok := input.PerClassCorpusWords[sourceClass]; ok {
		corpusWords = int(math.Max(0, math.Round(float64(cw))))
	}
	corpusTokens := 0
	if corpusWords > 0 {
		corpusTokens = int(math.Max(1, math.Round(float64(corpusWords)*(100.0/75.0))))
	}

	sourceCount := 0
	for _, s := range input.Graph.Sources {
		if s.SourceClass != nil && *s.SourceClass == sourceClass {
			sourceCount++
		}
	}

	pageCount := 0
	for _, p := range input.Graph.Pages {
		if p.SourceClass != nil && *p.SourceClass == sourceClass {
			pageCount++
		}
	}

	nodeCount := 0
	godNodeCount := 0
	for _, n := range input.Graph.Nodes {
		if n.SourceClass != nil && *n.SourceClass == sourceClass {
			nodeCount++
			if n.IsGodNode != nil && *n.IsGodNode {
				godNodeCount++
			}
		}
	}

	perQuestionRaw, ok := input.PerClassPerQuestion[sourceClass]
	if !ok {
		perQuestionRaw = make([]BenchmarkQuestionResult, 0)
	}

	perQuestion := make([]BenchmarkQuestionResult, 0)
	for _, entry := range perQuestionRaw {
		if entry.QueryTokens > 0 {
			reduction := 0.0
			if corpusTokens > 0 {
				reduction = float64(math.Round((1.0-float64(entry.QueryTokens)/math.Max(1.0, float64(corpusTokens)))*1000) / 1000)
			}
			entry.Reduction = reduction
			perQuestion = append(perQuestion, entry)
		}
	}

	finalContextTokens := 0
	if len(perQuestion) > 0 {
		total := 0
		for _, entry := range perQuestion {
			total += entry.QueryTokens
		}
		finalContextTokens = int(math.Max(1, math.Round(float64(total)/float64(len(perQuestion)))))
	}

	reductionRatio := 0.0
	if finalContextTokens > 0 && corpusTokens > 0 {
		reductionRatio = float64(math.Round((1.0-float64(finalContextTokens)/math.Max(1.0, float64(corpusTokens)))*1000) / 1000)
	}

	return BenchmarkByClassEntry{
		SourceClass:        sourceClass,
		SourceCount:        sourceCount,
		PageCount:          pageCount,
		NodeCount:          nodeCount,
		GodNodeCount:       godNodeCount,
		CorpusWords:        corpusWords,
		CorpusTokens:       corpusTokens,
		FinalContextTokens: finalContextTokens,
		ReductionRatio:     reductionRatio,
		PerQuestion:        perQuestion,
	}
}

func BuildBenchmarkByClass(input BuildBenchmarkByClassInput) map[SourceClass]BenchmarkByClassEntry {
	entries := make(map[SourceClass]BenchmarkByClassEntry)

	for _, sourceClass := range AllSourceClasses {
		entries[sourceClass] = buildClassEntry(sourceClass, input)
	}

	return entries
}

type BuildBenchmarkArtifactInput struct {
	Graph       GraphArtifact                         `json:"graph"`
	CorpusWords int                                   `json:"corpusWords"`
	Questions   []string                              `json:"questions"`
	PerQuestion []BenchmarkQuestionResult             `json:"perQuestion"`
	ByClass     map[SourceClass]BenchmarkByClassEntry `json:"byClass"`
}

func BuildBenchmarkArtifact(input BuildBenchmarkArtifactInput) BenchmarkArtifact {
	corpusTokens := int(math.Max(1, math.Round(float64(input.CorpusWords)*(100.0/75.0))))

	perQuestion := make([]BenchmarkQuestionResult, 0)
	for _, entry := range input.PerQuestion {
		if entry.QueryTokens > 0 {
			reduction := float64(math.Round((1.0-float64(entry.QueryTokens)/math.Max(1.0, float64(corpusTokens)))*1000) / 1000)
			entry.Reduction = reduction
			perQuestion = append(perQuestion, entry)
		}
	}

	avgQueryTokens := 0
	if len(perQuestion) > 0 {
		total := 0
		for _, entry := range perQuestion {
			total += entry.QueryTokens
		}
		avgQueryTokens = int(math.Max(1, math.Round(float64(total)/float64(len(perQuestion)))))
	}

	reductionRatio := 0.0
	if avgQueryTokens > 0 {
		reductionRatio = float64(math.Round((1.0-float64(avgQueryTokens)/math.Max(1.0, float64(corpusTokens)))*1000) / 1000)
	}

	uniqueVisitedNodesSet := make(map[string]bool)
	for _, entry := range perQuestion {
		for _, id := range entry.VisitedNodeIDs {
			uniqueVisitedNodesSet[id] = true
		}
	}
	uniqueVisitedNodes := len(uniqueVisitedNodesSet)

	summary := BenchmarkSummary{
		QuestionCount:      len(input.Questions),
		UniqueVisitedNodes: uniqueVisitedNodes,
		FinalContextTokens: avgQueryTokens,
		NaiveCorpusTokens:  corpusTokens,
		AvgReduction:       reductionRatio,
		ReductionRatio:     reductionRatio,
	}

	byClass := input.ByClass
	if byClass == nil {
		emptyPerClassWords := map[SourceClass]int{
			"first_party": 0,
			"third_party": 0,
			"resource":    0,
			"generated":   0,
		}
		emptyPerClassQuestions := map[SourceClass][]BenchmarkQuestionResult{
			"first_party": make([]BenchmarkQuestionResult, 0),
			"third_party": make([]BenchmarkQuestionResult, 0),
			"resource":    make([]BenchmarkQuestionResult, 0),
			"generated":   make([]BenchmarkQuestionResult, 0),
		}
		byClass = BuildBenchmarkByClass(BuildBenchmarkByClassInput{
			Graph:               input.Graph,
			PerClassCorpusWords: emptyPerClassWords,
			PerClassPerQuestion: emptyPerClassQuestions,
		})
	}

	return BenchmarkArtifact{
		GeneratedAt:     time.Now().UTC().Format("2006-01-02T15:04:05.000Z"), // ISO string approx
		GraphHash:       GraphHash(&input.Graph),
		CorpusWords:     input.CorpusWords,
		CorpusTokens:    corpusTokens,
		Nodes:           len(input.Graph.Nodes),
		Edges:           len(input.Graph.Edges),
		AvgQueryTokens:  avgQueryTokens,
		ReductionRatio:  reductionRatio,
		SampleQuestions: input.Questions,
		PerQuestion:     perQuestion,
		Summary:         summary,
		ByClass:         byClass,
	}
}
