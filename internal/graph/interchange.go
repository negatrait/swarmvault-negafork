package graph

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"swarmvault-native/internal/types"
)

var relationRegex = regexp.MustCompile(`[^A-Z0-9]+`)
var trimUnderscoreRegex = regexp.MustCompile(`^_+|_+$`)

func ExportHyperedgeNodeId(hyperedge types.GraphHyperedge) string {
	return fmt.Sprintf("hyperedge:%s", hyperedge.ID)
}

func RelationType(relation string) string {
	normalized := strings.ToUpper(relation)
	normalized = relationRegex.ReplaceAllString(normalized, "_")
	normalized = trimUnderscoreRegex.ReplaceAllString(normalized, "")
	if normalized == "" {
		return "RELATED_TO"
	}
	return normalized
}

func CypherStringLiteral(value string) string {
	var escaped strings.Builder
	for _, char := range value {
		switch char {
		case '\\':
			escaped.WriteString(`\\`)
		case '\'':
			escaped.WriteString(`\'`)
		case '\n':
			escaped.WriteString(`\n`)
		case '\r':
			escaped.WriteString(`\r`)
		case '\t':
			escaped.WriteString(`\t`)
		case '\b':
			escaped.WriteString(`\b`)
		case '\f':
			escaped.WriteString(`\f`)
		default:
			if char < 0x20 || char == 0x2028 || char == 0x2029 {
				escaped.WriteString(fmt.Sprintf(`\u%04x`, char))
			} else {
				escaped.WriteRune(char)
			}
		}
	}
	return fmt.Sprintf("'%s'", escaped.String())
}

func GraphPageById(graph types.GraphArtifact) map[string]types.GraphPage {
	result := make(map[string]types.GraphPage)
	for _, page := range graph.Pages {
		result[page.ID] = page
	}
	return result
}

func GraphNodeById(graph types.GraphArtifact) map[string]types.GraphNode {
	result := make(map[string]types.GraphNode)
	for _, node := range graph.Nodes {
		result[node.ID] = node
	}
	return result
}

func NormalizeSwarmNodeProps(node types.GraphNode, page *types.GraphPage) map[string]any {
	props := map[string]any{
		"id":    node.ID,
		"label": node.Label,
		"type":  node.Type,
	}

	if sourceIdsBytes, err := json.Marshal(node.SourceIDs); err == nil {
		props["sourceIds"] = string(sourceIdsBytes)
	}
	if projectIdsBytes, err := json.Marshal(node.ProjectIDs); err == nil {
		props["projectIds"] = string(projectIdsBytes)
	}

	if node.PageID != nil {
		props["pageId"] = *node.PageID
	}
	if page != nil && page.Path != "" {
		props["pagePath"] = page.Path
	}
	if node.SourceClass != nil {
		props["sourceClass"] = *node.SourceClass
	}
	if node.Language != nil {
		props["language"] = *node.Language
	}
	if node.ModuleID != nil {
		props["moduleId"] = *node.ModuleID
	}
	if node.SymbolKind != nil {
		props["symbolKind"] = *node.SymbolKind
	}
	if node.CommunityID != nil {
		props["communityId"] = *node.CommunityID
	}
	if node.Freshness != nil {
		props["freshness"] = *node.Freshness
	}
	if node.Confidence != nil {
		props["confidence"] = *node.Confidence
	}
	if node.Degree != nil {
		props["degree"] = *node.Degree
	}
	if node.BridgeScore != nil {
		props["bridgeScore"] = *node.BridgeScore
	}
	if node.IsGodNode != nil {
		props["isGodNode"] = *node.IsGodNode
	}
	if node.SurpriseReason != nil {
		props["surpriseReason"] = *node.SurpriseReason
	}

	return props
}

func NormalizeHyperedgeNodeProps(hyperedge types.GraphHyperedge) map[string]any {
	props := map[string]any{
		"id":            ExportHyperedgeNodeId(hyperedge),
		"label":         hyperedge.Label,
		"type":          "hyperedge",
		"relation":      hyperedge.Relation,
		"evidenceClass": hyperedge.EvidenceClass,
		"confidence":    hyperedge.Confidence,
		"why":           hyperedge.Why,
	}

	if sourcePageIdsBytes, err := json.Marshal(hyperedge.SourcePageIDs); err == nil {
		props["sourcePageIds"] = string(sourcePageIdsBytes)
	}

	return props
}

func NormalizeEdgeProps(edge types.GraphEdge) map[string]any {
	props := map[string]any{
		"id":            edge.ID,
		"relation":      edge.Relation,
		"status":        edge.Status,
		"evidenceClass": edge.EvidenceClass,
		"confidence":    edge.Confidence,
	}

	if provenanceBytes, err := json.Marshal(edge.Provenance); err == nil {
		props["provenance"] = string(provenanceBytes)
	}

	if edge.SimilarityReasons != nil && len(edge.SimilarityReasons) > 0 {
		if reasonsBytes, err := json.Marshal(edge.SimilarityReasons); err == nil {
			props["similarityReasons"] = string(reasonsBytes)
		}
	}
	if edge.SimilarityBasis != nil {
		props["similarityBasis"] = *edge.SimilarityBasis
	}

	return props
}

func NormalizeGroupMemberProps(hyperedge types.GraphHyperedge, nodeId string) map[string]any {
	props := map[string]any{
		"id":            fmt.Sprintf("member:%s:%s", hyperedge.ID, nodeId),
		"relation":      "group_member",
		"status":        "inferred",
		"evidenceClass": hyperedge.EvidenceClass,
		"confidence":    hyperedge.Confidence,
	}

	if provenanceBytes, err := json.Marshal(hyperedge.SourcePageIDs); err == nil {
		props["provenance"] = string(provenanceBytes)
	}

	return props
}

func FilterGraphBySourceClasses(graph types.GraphArtifact, includeClasses []types.SourceClass) types.GraphArtifact {
	allowed := make(map[types.SourceClass]bool)
	for _, class := range includeClasses {
		allowed[class] = true
	}

	nodeIds := make(map[string]bool)
	for _, node := range graph.Nodes {
		if node.SourceClass != nil && allowed[*node.SourceClass] {
			nodeIds[node.ID] = true
		}
	}

	pageIds := make(map[string]bool)
	for _, page := range graph.Pages {
		if page.SourceClass != nil && allowed[*page.SourceClass] {
			pageIds[page.ID] = true
		}
	}

	var newNodes []types.GraphNode
	for _, node := range graph.Nodes {
		if nodeIds[node.ID] {
			newNodes = append(newNodes, node)
		}
	}
	if newNodes == nil {
		newNodes = make([]types.GraphNode, 0)
	}

	var newEdges []types.GraphEdge
	for _, edge := range graph.Edges {
		if nodeIds[edge.Source] && nodeIds[edge.Target] {
			newEdges = append(newEdges, edge)
		}
	}
	if newEdges == nil {
		newEdges = make([]types.GraphEdge, 0)
	}

	var newHyperedges []types.GraphHyperedge
	for _, hyperedge := range graph.Hyperedges {
		var newNodeIds []string
		for _, id := range hyperedge.NodeIDs {
			if nodeIds[id] {
				newNodeIds = append(newNodeIds, id)
			}
		}
		if newNodeIds == nil {
			newNodeIds = make([]string, 0)
		}

		if len(newNodeIds) >= 2 {
			newHyperedge := hyperedge
			newHyperedge.NodeIDs = newNodeIds
			newHyperedges = append(newHyperedges, newHyperedge)
		}
	}
	if newHyperedges == nil {
		newHyperedges = make([]types.GraphHyperedge, 0)
	}

	var newCommunities []types.GraphCommunity
	if graph.Communities != nil {
		for _, community := range graph.Communities {
			var newNodeIds []string
			for _, id := range community.NodeIDs {
				if nodeIds[id] {
					newNodeIds = append(newNodeIds, id)
				}
			}
			if newNodeIds == nil {
				newNodeIds = make([]string, 0)
			}

			if len(newNodeIds) > 0 {
				newCommunity := community
				newCommunity.NodeIDs = newNodeIds
				newCommunities = append(newCommunities, newCommunity)
			}
		}
	}
	if newCommunities == nil {
		newCommunities = make([]types.GraphCommunity, 0)
	}

	var newSources []types.SourceManifest
	for _, source := range graph.Sources {
		if source.SourceClass != nil && allowed[*source.SourceClass] {
			newSources = append(newSources, source)
		}
	}
	if newSources == nil {
		newSources = make([]types.SourceManifest, 0)
	}

	var newPages []types.GraphPage
	for _, page := range graph.Pages {
		if pageIds[page.ID] {
			newPages = append(newPages, page)
		}
	}
	if newPages == nil {
		newPages = make([]types.GraphPage, 0)
	}

	newGraph := graph
	newGraph.Nodes = newNodes
	newGraph.Edges = newEdges
	newGraph.Hyperedges = newHyperedges
	newGraph.Communities = newCommunities
	newGraph.Sources = newSources
	newGraph.Pages = newPages

	return newGraph
}

func GraphCounts(graph types.GraphArtifact) types.GraphPushCounts {
	groupMembers := 0
	for _, hyperedge := range graph.Hyperedges {
		groupMembers += len(hyperedge.NodeIDs)
	}

	return types.GraphPushCounts{
		Sources:       len(graph.Sources),
		Pages:         len(graph.Pages),
		Nodes:         len(graph.Nodes),
		Relationships: len(graph.Edges),
		Hyperedges:    len(graph.Hyperedges),
		GroupMembers:  groupMembers,
	}
}
