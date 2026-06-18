package benchmark

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
)

const CharsPerToken = 4

var DefaultBenchmarkQuestions = []string{
	"How does this vault connect the main concepts?",
	"Which pages bridge the biggest communities?",
	"What are the core abstractions in this vault?",
	"Where are the biggest knowledge gaps?",
	"What evidence should I read first?",
}

const ResearchBenchmarkQuestion = "Which research sources should I read first, and why?"

var AllSourceClasses = []SourceClass{
	"first_party",
	"third_party",
	"resource",
	"generated",
}

func EstimateTokens(text string) int {
	return int(math.Max(1, math.Ceil(float64(len(text))/float64(CharsPerToken))))
}

var whitespaceRegex = regexp.MustCompile(`\s+`)

func NormalizeWhitespace(value string) string {
	return strings.TrimSpace(whitespaceRegex.ReplaceAllString(value, " "))
}

func EstimateCorpusWords(texts []string) int {
	total := 0
	for _, text := range texts {
		normalized := NormalizeWhitespace(text)
		if normalized == "" {
			continue
		}
		words := strings.Split(normalized, " ")
		count := 0
		for _, w := range words {
			if w != "" {
				count++
			}
		}
		total += count
	}
	return total
}

func nodeMap(graph GraphArtifact) map[string]GraphNode {
	m := make(map[string]GraphNode)
	for _, node := range graph.Nodes {
		m[node.ID] = node
	}
	return m
}

func pageMap(graph GraphArtifact) map[string]GraphPage {
	m := make(map[string]GraphPage)
	for _, page := range graph.Pages {
		m[page.ID] = page
	}
	return m
}

func BenchmarkQueryTokens(graph GraphArtifact, queryResult GraphQueryResult, pageContentsById map[string]string) BenchmarkQuestionResult {
	nodesById := nodeMap(graph)
	pagesById := pageMap(graph)

	edgeIds := make(map[string]bool)
	for _, id := range queryResult.VisitedEdgeIDs {
		edgeIds[id] = true
	}

	var lines []string

	for _, pageId := range queryResult.PageIDs {
		page, ok := pagesById[pageId]
		if !ok {
			continue
		}
		content := ""
		if c, ok := pageContentsById[pageId]; ok {
			content = NormalizeWhitespace(c)
		}
		if len(content) > 280 {
			content = content[:280]
		}

		lines = append(lines, fmt.Sprintf("PAGE %s path=%s kind=%s", page.Title, page.Path, page.Kind))
		if content != "" {
			lines = append(lines, fmt.Sprintf("PAGE_BODY %s", content))
		}
	}

	for _, nodeId := range queryResult.VisitedNodeIDs {
		node, ok := nodesById[nodeId]
		if !ok {
			continue
		}
		communityId := "unassigned"
		if node.CommunityID != nil {
			communityId = *node.CommunityID
		}
		pageId := "none"
		if node.PageID != nil {
			pageId = *node.PageID
		}
		lines = append(lines, fmt.Sprintf("NODE %s type=%s community=%s page=%s", node.Label, node.Type, communityId, pageId))
	}

	for _, edge := range graph.Edges {
		if !edgeIds[edge.ID] {
			continue
		}
		sourceLabel := edge.Source
		if sourceNode, ok := nodesById[edge.Source]; ok {
			sourceLabel = sourceNode.Label
		}
		targetLabel := edge.Target
		if targetNode, ok := nodesById[edge.Target]; ok {
			targetLabel = targetNode.Label
		}
		lines = append(lines, fmt.Sprintf("EDGE %s --%s/%s/%.2f--> %s", sourceLabel, edge.Relation, edge.EvidenceClass, edge.Confidence, targetLabel))
	}

	queryTokens := EstimateTokens(strings.Join(lines, "\n"))

	return BenchmarkQuestionResult{
		Question:       queryResult.Question,
		QueryTokens:    queryTokens,
		Reduction:      0,
		VisitedNodeIDs: queryResult.VisitedNodeIDs,
		VisitedEdgeIDs: queryResult.VisitedEdgeIDs,
		PageIDs:        queryResult.PageIDs,
	}
}

// Custom sort functions
func sortStrings(s []string) []string {
	res := make([]string, len(s))
	copy(res, s)
	sort.Strings(res)
	return res
}

func GraphHash(graph GraphArtifact) string {
	var hashedPages []GraphPage
	for _, p := range graph.Pages {
		if p.Kind != "graph_report" && p.Kind != "community_summary" {
			hashedPages = append(hashedPages, p)
		}
	}

	type mappedNode struct {
		ID          string       `json:"id"`
		Type        string       `json:"type"`
		Label       string       `json:"label"`
		PageID      *string      `json:"pageId"`
		SourceClass *SourceClass `json:"sourceClass"`
		CommunityID *string      `json:"communityId"`
		Degree      *int         `json:"degree"`
		BridgeScore *float64     `json:"bridgeScore"`
		IsGodNode   bool         `json:"isGodNode"`
		SourceIDs   []string     `json:"sourceIds"`
		ProjectIDs  []string     `json:"projectIds"`
	}

	var mappedNodes []mappedNode
	for _, n := range graph.Nodes {
		isGod := false
		if n.IsGodNode != nil {
			isGod = *n.IsGodNode
		}
		mappedNodes = append(mappedNodes, mappedNode{
			ID:          n.ID,
			Type:        n.Type,
			Label:       n.Label,
			PageID:      n.PageID,
			SourceClass: n.SourceClass,
			CommunityID: n.CommunityID,
			Degree:      n.Degree,
			BridgeScore: n.BridgeScore,
			IsGodNode:   isGod,
			SourceIDs:   sortStrings(n.SourceIDs),
			ProjectIDs:  sortStrings(n.ProjectIDs),
		})
	}
	sort.SliceStable(mappedNodes, func(i, j int) bool {
		return mappedNodes[i].ID < mappedNodes[j].ID
	})

	type mappedEdge struct {
		ID              string        `json:"id"`
		Source          string        `json:"source"`
		Target          string        `json:"target"`
		Relation        string        `json:"relation"`
		Status          ClaimStatus   `json:"status"`
		EvidenceClass   EvidenceClass `json:"evidenceClass"`
		SimilarityBasis *string       `json:"similarityBasis"`
		Confidence      float64       `json:"confidence"`
		Provenance      []string      `json:"provenance"`
	}
	var mappedEdges []mappedEdge
	for _, e := range graph.Edges {
		mappedEdges = append(mappedEdges, mappedEdge{
			ID:              e.ID,
			Source:          e.Source,
			Target:          e.Target,
			Relation:        e.Relation,
			Status:          e.Status,
			EvidenceClass:   e.EvidenceClass,
			SimilarityBasis: e.SimilarityBasis,
			Confidence:      e.Confidence,
			Provenance:      sortStrings(e.Provenance),
		})
	}
	sort.SliceStable(mappedEdges, func(i, j int) bool {
		return mappedEdges[i].ID < mappedEdges[j].ID
	})

	type mappedPage struct {
		ID          string             `json:"id"`
		Path        string             `json:"path"`
		Kind        PageKind           `json:"kind"`
		Status      *string            `json:"status"`
		SourceType  *SourceCaptureType `json:"sourceType"`
		SourceClass *SourceClass       `json:"sourceClass"`
		SourceIDs   []string           `json:"sourceIds"`
		ProjectIDs  []string           `json:"projectIds"`
		NodeIDs     []string           `json:"nodeIds"`
	}
	var mappedPages []mappedPage
	for _, p := range hashedPages {
		mappedPages = append(mappedPages, mappedPage{
			ID:          p.ID,
			Path:        p.Path,
			Kind:        p.Kind,
			Status:      p.Status,
			SourceType:  p.SourceType,
			SourceClass: p.SourceClass,
			SourceIDs:   sortStrings(p.SourceIDs),
			ProjectIDs:  sortStrings(p.ProjectIDs),
			NodeIDs:     sortStrings(p.NodeIDs),
		})
	}
	sort.SliceStable(mappedPages, func(i, j int) bool {
		return mappedPages[i].ID < mappedPages[j].ID
	})

	type mappedCommunity struct {
		ID      string   `json:"id"`
		Label   string   `json:"label"`
		NodeIDs []string `json:"nodeIds"`
	}
	var mappedCommunities []mappedCommunity
	if graph.Communities != nil {
		for _, c := range *graph.Communities {
			mappedCommunities = append(mappedCommunities, mappedCommunity{
				ID:      c.ID,
				Label:   c.Label,
				NodeIDs: sortStrings(c.NodeIDs),
			})
		}
	} else {
		mappedCommunities = make([]mappedCommunity, 0)
	}
	sort.SliceStable(mappedCommunities, func(i, j int) bool {
		return mappedCommunities[i].ID < mappedCommunities[j].ID
	})

	normalizedObj := struct {
		Nodes       []mappedNode      `json:"nodes"`
		Edges       []mappedEdge      `json:"edges"`
		Pages       []mappedPage      `json:"pages"`
		Communities []mappedCommunity `json:"communities"`
	}{
		Nodes:       mappedNodes,
		Edges:       mappedEdges,
		Pages:       mappedPages,
		Communities: mappedCommunities,
	}

	b, _ := json.Marshal(normalizedObj)

	h := sha256.New()
	h.Write(b)
	return hex.EncodeToString(h.Sum(nil))
}

func hasResearchSources(pages []GraphPage) bool {
	for _, p := range pages {
		if p.Kind == "source" && p.SourceType != nil && *p.SourceType != "url" {
			return true
		}
	}
	return false
}

func uniqueStrings(items []string) []string {
	seen := make(map[string]bool)
	var res []string
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			res = append(res, item)
		}
	}
	return res
}

func DefaultBenchmarkQuestionsForGraph(graph GraphArtifact, maxQuestions int) []string {
	normalizedLimit := int(math.Max(1, math.Min(float64(maxQuestions), float64(len(DefaultBenchmarkQuestions)))))
	questions := make([]string, len(DefaultBenchmarkQuestions))
	copy(questions, DefaultBenchmarkQuestions)

	if hasResearchSources(graph.Pages) {
		questions = append([]string{ResearchBenchmarkQuestion}, questions...)
	}

	uniqueQs := uniqueStrings(questions)
	if len(uniqueQs) > normalizedLimit {
		return uniqueQs[:normalizedLimit]
	}
	return uniqueQs
}

type BuildBenchmarkByClassInput struct {
	Graph               GraphArtifact                             `json:"graph"`
	PerClassCorpusWords map[SourceClass]int                       `json:"perClassCorpusWords"`
	PerClassPerQuestion map[SourceClass][]BenchmarkQuestionResult `json:"perClassPerQuestion"`
}

func BuildBenchmarkByClass(input BuildBenchmarkByClassInput) map[SourceClass]BenchmarkByClassEntry {
	entries := make(map[SourceClass]BenchmarkByClassEntry)

	for _, sourceClass := range AllSourceClasses {
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

		entries[sourceClass] = BenchmarkByClassEntry{
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
		GraphHash:       GraphHash(input.Graph),
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
