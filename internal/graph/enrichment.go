package graph

import (
	"fmt"
	"sort"
	"strings"

	"swarmvault-native/internal/types"
	"swarmvault-native/internal/utils"
)

func BuildTopicHyperedges(graph types.GraphArtifact) []types.GraphHyperedge {
	nodesById := make(map[string]types.GraphNode)
	for _, node := range graph.Nodes {
		nodesById[node.ID] = node
	}
	connectedSources := make(map[string][]string)
	var anchorOrder []string

	for _, edge := range graph.Edges {
		if edge.Relation != "mentions" || edge.EvidenceClass != types.EvidenceClassExtracted {
			continue
		}
		sourceNode, okSrc := nodesById[edge.Source]
		targetNode, okTgt := nodesById[edge.Target]
		if !okSrc || !okTgt {
			continue
		}
		if sourceNode.Type != "source" || (targetNode.Type != "concept" && targetNode.Type != "entity") {
			continue
		}
		if _, exists := connectedSources[targetNode.ID]; !exists {
			anchorOrder = append(anchorOrder, targetNode.ID)
		}
		connectedSources[targetNode.ID] = append(connectedSources[targetNode.ID], sourceNode.ID)
	}

	res := make([]types.GraphHyperedge, 0)
	for _, anchorId := range anchorOrder {
		members := connectedSources[anchorId]
		anchor := nodesById[anchorId]
		uniqueMembers := utils.UniqueStrings(members)
		sort.Strings(uniqueMembers)

		if len(uniqueMembers) < 3 {
			continue
		}

		nodeIds := make([]string, 0, 1+len(uniqueMembers))
		nodeIds = append(nodeIds, anchor.ID)
		nodeIds = append(nodeIds, uniqueMembers...)

		var sourcePageIdsRaw []string
		for _, nID := range nodeIds {
			if n, ok := nodesById[nID]; ok && n.PageID != nil && *n.PageID != "" {
				sourcePageIdsRaw = append(sourcePageIdsRaw, *n.PageID)
			}
		}
		sourcePageIds := utils.UniqueStrings(sourcePageIdsRaw)

		conf := 0.72 + float64(len(uniqueMembers))*0.06
		if conf > 0.96 {
			conf = 0.96
		}

		hashInput := fmt.Sprintf("participate_in|%s|%s", anchor.ID, strings.Join(uniqueMembers, "|"))
		hash := utils.Sha256String(hashInput)
		if len(hash) > 16 {
			hash = hash[:16]
		}

		var label string
		if anchor.Label != "" {
			label = anchor.Label
		}

		res = append(res, types.GraphHyperedge{
			ID:            "hyper:" + hash,
			Label:         label,
			Relation:      "participate_in",
			NodeIDs:       nodeIds,
			EvidenceClass: types.EvidenceClassExtracted,
			Confidence:    conf,
			SourcePageIDs: sourcePageIds,
			Why:           fmt.Sprintf("%d source nodes converge on %s through extracted mention edges.", len(uniqueMembers), label),
		})
	}

	return res
}

func BuildModuleFormHyperedges(graph types.GraphArtifact) []types.GraphHyperedge {
	nodesById := make(map[string]types.GraphNode)
	for _, node := range graph.Nodes {
		nodesById[node.ID] = node
	}
	definedSymbols := make(map[string][]string)
	var moduleOrder []string

	for _, edge := range graph.Edges {
		if edge.Relation != "defines" || edge.EvidenceClass != types.EvidenceClassExtracted {
			continue
		}
		moduleNode, okSrc := nodesById[edge.Source]
		symbolNode, okTgt := nodesById[edge.Target]
		if !okSrc || !okTgt {
			continue
		}
		if moduleNode.Type != "module" || symbolNode.Type != "symbol" {
			continue
		}
		if _, exists := definedSymbols[moduleNode.ID]; !exists {
			moduleOrder = append(moduleOrder, moduleNode.ID)
		}
		definedSymbols[moduleNode.ID] = append(definedSymbols[moduleNode.ID], symbolNode.ID)
	}

	res := make([]types.GraphHyperedge, 0)
	for _, moduleId := range moduleOrder {
		members := definedSymbols[moduleId]
		moduleNode := nodesById[moduleId]
		uniqueMembers := utils.UniqueStrings(members)
		sort.Strings(uniqueMembers)

		if len(uniqueMembers) < 3 {
			continue
		}

		nodeIds := make([]string, 0, 1+len(uniqueMembers))
		nodeIds = append(nodeIds, moduleNode.ID)
		nodeIds = append(nodeIds, uniqueMembers...)

		var sourcePageIdsRaw []string
		for _, nID := range nodeIds {
			if n, ok := nodesById[nID]; ok && n.PageID != nil && *n.PageID != "" {
				sourcePageIdsRaw = append(sourcePageIdsRaw, *n.PageID)
			}
		}
		sourcePageIds := utils.UniqueStrings(sourcePageIdsRaw)

		conf := 0.78 + float64(len(uniqueMembers))*0.04
		if conf > 0.98 {
			conf = 0.98
		}

		hashInput := fmt.Sprintf("form|%s|%s", moduleNode.ID, strings.Join(uniqueMembers, "|"))
		hash := utils.Sha256String(hashInput)
		if len(hash) > 16 {
			hash = hash[:16]
		}

		var label string
		if moduleNode.Label != "" {
			label = moduleNode.Label
		}

		res = append(res, types.GraphHyperedge{
			ID:            "hyper:" + hash,
			Label:         fmt.Sprintf("%s API", label),
			Relation:      "form",
			NodeIDs:       nodeIds,
			EvidenceClass: types.EvidenceClassExtracted,
			Confidence:    conf,
			SourcePageIDs: sourcePageIds,
			Why:           fmt.Sprintf("%s and %d defined symbols form one local module surface.", label, len(uniqueMembers)),
		})
	}

	return res
}
