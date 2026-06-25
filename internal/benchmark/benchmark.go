package benchmark

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"slices"
	"strings"

	"swarmvault-native/internal/utils"
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

func NormalizeWhitespace(value string) string {
	return utils.NormalizeWhitespace(value)
}
func EstimateCorpusWords(texts []string) int {
	total := 0
	for _, text := range texts {
		total += len(strings.Fields(text))
	}
	return total
}

func nodeMap(graph *GraphArtifact) map[string]GraphNode {
	m := make(map[string]GraphNode)
	for _, node := range graph.Nodes {
		m[node.ID] = node
	}
	return m
}

func pageMap(graph *GraphArtifact) map[string]GraphPage {
	m := make(map[string]GraphPage)
	for _, page := range graph.Pages {
		m[page.ID] = page
	}
	return m
}

func BenchmarkQueryTokens(graph *GraphArtifact, queryResult GraphQueryResult, pageContentsById map[string]string) BenchmarkQuestionResult {
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

type mappedCommunity struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	NodeIDs []string `json:"nodeIds"`
}

func mapNodes(nodes []GraphNode) []mappedNode {
	var mappedNodes []mappedNode
	for _, n := range nodes {
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
			SourceIDs:   utils.SortStrings(n.SourceIDs),
			ProjectIDs:  utils.SortStrings(n.ProjectIDs),
		})
	}
	slices.SortStableFunc(mappedNodes, func(a, b mappedNode) int { return strings.Compare(a.ID, b.ID) })
	return mappedNodes
}

func mapEdges(edges []GraphEdge) []mappedEdge {
	var mappedEdges []mappedEdge
	for _, e := range edges {
		mappedEdges = append(mappedEdges, mappedEdge{
			ID:              e.ID,
			Source:          e.Source,
			Target:          e.Target,
			Relation:        e.Relation,
			Status:          e.Status,
			EvidenceClass:   e.EvidenceClass,
			SimilarityBasis: e.SimilarityBasis,
			Confidence:      e.Confidence,
			Provenance:      utils.SortStrings(e.Provenance),
		})
	}
	slices.SortStableFunc(mappedEdges, func(a, b mappedEdge) int { return strings.Compare(a.ID, b.ID) })
	return mappedEdges
}

func mapPages(pages []GraphPage) []mappedPage {
	var mappedPages []mappedPage
	for _, p := range pages {
		mappedPages = append(mappedPages, mappedPage{
			ID:          p.ID,
			Path:        p.Path,
			Kind:        p.Kind,
			Status:      p.Status,
			SourceType:  p.SourceType,
			SourceClass: p.SourceClass,
			SourceIDs:   utils.SortStrings(p.SourceIDs),
			ProjectIDs:  utils.SortStrings(p.ProjectIDs),
			NodeIDs:     utils.SortStrings(p.NodeIDs),
		})
	}
	slices.SortStableFunc(mappedPages, func(a, b mappedPage) int { return strings.Compare(a.ID, b.ID) })
	return mappedPages
}

func mapCommunities(communities *[]GraphCommunity) []mappedCommunity {
	var mappedCommunities []mappedCommunity
	if communities != nil {
		for _, c := range *communities {
			mappedCommunities = append(mappedCommunities, mappedCommunity{
				ID:      c.ID,
				Label:   c.Label,
				NodeIDs: utils.SortStrings(c.NodeIDs),
			})
		}
	} else {
		mappedCommunities = make([]mappedCommunity, 0)
	}
	slices.SortStableFunc(mappedCommunities, func(a, b mappedCommunity) int { return strings.Compare(a.ID, b.ID) })
	return mappedCommunities
}

func GraphHash(graph *GraphArtifact) string {
	var hashedPages []GraphPage
	for _, p := range graph.Pages {
		if p.Kind != "graph_report" && p.Kind != "community_summary" {
			hashedPages = append(hashedPages, p)
		}
	}

	normalizedObj := struct {
		Nodes       []mappedNode      `json:"nodes"`
		Edges       []mappedEdge      `json:"edges"`
		Pages       []mappedPage      `json:"pages"`
		Communities []mappedCommunity `json:"communities"`
	}{
		Nodes:       mapNodes(graph.Nodes),
		Edges:       mapEdges(graph.Edges),
		Pages:       mapPages(hashedPages),
		Communities: mapCommunities(graph.Communities),
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

func DefaultBenchmarkQuestionsForGraph(graph *GraphArtifact, maxQuestions int) []string {
	normalizedLimit := int(math.Max(1, math.Min(float64(maxQuestions), float64(len(DefaultBenchmarkQuestions)))))
	questions := make([]string, len(DefaultBenchmarkQuestions))
	copy(questions, DefaultBenchmarkQuestions)

	if hasResearchSources(graph.Pages) {
		questions = append([]string{ResearchBenchmarkQuestion}, questions...)
	}

	uniqueQs := utils.UniqueStrings(questions)
	if len(uniqueQs) > normalizedLimit {
		return uniqueQs[:normalizedLimit]
	}
	return uniqueQs
}
