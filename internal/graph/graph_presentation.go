package graph

import (
	"cmp"
	"sort"
	"swarmvault-native/internal/types"
)

const (
	OverviewThreshold  = 5000
	OverviewNodeBudget = 1500
)

type ViewerGraphPresentation struct {
	Mode                 string `json:"mode"`
	Threshold            int    `json:"threshold"`
	NodeBudget           int    `json:"nodeBudget"`
	TotalNodes           int    `json:"totalNodes"`
	DisplayedNodes       int    `json:"displayedNodes"`
	TotalEdges           int    `json:"totalEdges"`
	DisplayedEdges       int    `json:"displayedEdges"`
	TotalCommunities     int    `json:"totalCommunities"`
	DisplayedCommunities int    `json:"displayedCommunities"`
}

type ViewerGraphArtifact struct {
	types.GraphArtifact
	Presentation ViewerGraphPresentation `json:"presentation"`
}

type Options struct {
	Report     *types.GraphReportArtifact `json:"report,omitempty"`
	Full       *bool                      `json:"full,omitempty"`
	Threshold  *int                       `json:"threshold,omitempty"`
	NodeBudget *int                       `json:"nodeBudget,omitempty"`
}

type nodePriorityTuple struct {
	isNotPinned int
	negDegree   int
	negBridge   float64
	label       string
	id          string
}

func getNodePriority(node types.GraphNode, pinnedNodeIds map[string]struct{}) nodePriorityTuple {
	isNotPinned := 1
	if _, ok := pinnedNodeIds[node.ID]; ok {
		isNotPinned = 0
	}
	negDegree := 0
	if node.Degree != nil {
		negDegree = -*node.Degree
	}
	negBridge := 0.0
	if node.BridgeScore != nil {
		negBridge = -*node.BridgeScore
	}
	label := node.Label
	return nodePriorityTuple{
		isNotPinned: isNotPinned,
		negDegree:   negDegree,
		negBridge:   negBridge,
		label:       label,
		id:          node.ID,
	}
}

func compareNodePriority(a, b nodePriorityTuple) int {
	if c := cmp.Compare(a.isNotPinned, b.isNotPinned); c != 0 {
		return c
	}
	if c := cmp.Compare(a.negDegree, b.negDegree); c != 0 {
		return c
	}
	if c := cmp.Compare(a.negBridge, b.negBridge); c != 0 {
		return c
	}
	if c := cmp.Compare(a.label, b.label); c != 0 {
		return c
	}
	return cmp.Compare(a.id, b.id)
}

func survivingHyperedges(hyperedges []types.GraphHyperedge, sampledNodeIds map[string]struct{}) []types.GraphHyperedge {
	result := make([]types.GraphHyperedge, 0)
	for _, he := range hyperedges {
		count := 0
		for _, nid := range he.NodeIDs {
			if _, ok := sampledNodeIds[nid]; ok {
				count++
			}
		}
		if count >= 2 {
			result = append(result, he)
		}
	}
	return result
}

func pinnedNodeIdsForReport(report *types.GraphReportArtifact) map[string]struct{} {
	pinned := make(map[string]struct{})
	if report == nil {
		return pinned
	}
	for _, n := range report.GodNodes {
		pinned[n.NodeID] = struct{}{}
	}
	for _, n := range report.BridgeNodes {
		pinned[n.NodeID] = struct{}{}
	}
	for _, c := range report.SurprisingConnections {
		pinned[c.SourceNodeID] = struct{}{}
		pinned[c.TargetNodeID] = struct{}{}
	}
	return pinned
}

type communityPriorityTuple struct {
	negFirstParty int
	negLength     int
	label         string
	id            string
}

func compareCommunityPriority(a, b communityPriorityTuple) int {
	if c := cmp.Compare(a.negFirstParty, b.negFirstParty); c != 0 {
		return c
	}
	if c := cmp.Compare(a.negLength, b.negLength); c != 0 {
		return c
	}
	if c := cmp.Compare(a.label, b.label); c != 0 {
		return c
	}
	return cmp.Compare(a.id, b.id)
}

func sampleGraphNodes(graph types.GraphArtifact, report *types.GraphReportArtifact, nodeBudget int) map[string]struct{} {
	pinned := pinnedNodeIdsForReport(report)
	nodeById := make(map[string]types.GraphNode)
	for _, n := range graph.Nodes {
		nodeById[n.ID] = n
	}

	selected := make(map[string]struct{})
	for pid := range pinned {
		if _, ok := nodeById[pid]; ok {
			selected[pid] = struct{}{}
		}
	}

	sortedCommunities := make([]types.GraphCommunity, len(graph.Communities))
	copy(sortedCommunities, graph.Communities)

	sort.SliceStable(sortedCommunities, func(i, j int) bool {
		left := sortedCommunities[i]
		right := sortedCommunities[j]

		leftNodes := make([]types.GraphNode, 0)
		for _, nid := range left.NodeIDs {
			if n, ok := nodeById[nid]; ok {
				leftNodes = append(leftNodes, n)
			}
		}
		rightNodes := make([]types.GraphNode, 0)
		for _, nid := range right.NodeIDs {
			if n, ok := nodeById[nid]; ok {
				rightNodes = append(rightNodes, n)
			}
		}

		leftFirstParty := 0
		for _, n := range leftNodes {
			if n.SourceClass != nil && *n.SourceClass == "first_party" {
				leftFirstParty++
			}
		}
		rightFirstParty := 0
		for _, n := range rightNodes {
			if n.SourceClass != nil && *n.SourceClass == "first_party" {
				rightFirstParty++
			}
		}

		a := communityPriorityTuple{-leftFirstParty, -len(leftNodes), left.Label, left.ID}
		b := communityPriorityTuple{-rightFirstParty, -len(rightNodes), right.Label, right.ID}

		return compareCommunityPriority(a, b) < 0
	})

	for _, community := range sortedCommunities {
		communityNodes := make([]types.GraphNode, 0)
		for _, nid := range community.NodeIDs {
			if n, ok := nodeById[nid]; ok {
				communityNodes = append(communityNodes, n)
			}
		}
		sort.SliceStable(communityNodes, func(i, j int) bool {
			pi := getNodePriority(communityNodes[i], pinned)
			pj := getNodePriority(communityNodes[j], pinned)
			return compareNodePriority(pi, pj) < 0
		})

		for _, node := range communityNodes {
			_, isPinned := pinned[node.ID]
			if len(selected) >= nodeBudget && !isPinned {
				break
			}
			selected[node.ID] = struct{}{}
		}
		if len(selected) >= nodeBudget {
			break
		}
	}

	if len(selected) < nodeBudget {
		allNodes := make([]types.GraphNode, len(graph.Nodes))
		copy(allNodes, graph.Nodes)
		sort.SliceStable(allNodes, func(i, j int) bool {
			pi := getNodePriority(allNodes[i], pinned)
			pj := getNodePriority(allNodes[j], pinned)
			return compareNodePriority(pi, pj) < 0
		})

		for _, node := range allNodes {
			_, isPinned := pinned[node.ID]
			if len(selected) >= nodeBudget && !isPinned {
				break
			}
			selected[node.ID] = struct{}{}
		}
	}

	return selected
}

func BuildViewerGraphArtifact(graph types.GraphArtifact, options Options) ViewerGraphArtifact {
	threshold := OverviewThreshold
	if options.Threshold != nil {
		threshold = *options.Threshold
	}
	nodeBudget := OverviewNodeBudget
	if options.NodeBudget != nil {
		nodeBudget = *options.NodeBudget
	}

	totalCommunities := len(graph.Communities)

	isFull := false
	if options.Full != nil {
		isFull = *options.Full
	}

	if isFull || len(graph.Nodes) <= threshold {
		return ViewerGraphArtifact{
			GraphArtifact: graph,
			Presentation: ViewerGraphPresentation{
				Mode:                 "full",
				Threshold:            threshold,
				NodeBudget:           nodeBudget,
				TotalNodes:           len(graph.Nodes),
				DisplayedNodes:       len(graph.Nodes),
				TotalEdges:           len(graph.Edges),
				DisplayedEdges:       len(graph.Edges),
				TotalCommunities:     totalCommunities,
				DisplayedCommunities: totalCommunities,
			},
		}
	}

	sampledNodeIds := sampleGraphNodes(graph, options.Report, nodeBudget)

	nodes := make([]types.GraphNode, 0)
	for _, n := range graph.Nodes {
		if _, ok := sampledNodeIds[n.ID]; ok {
			nodes = append(nodes, n)
		}
	}

	edges := make([]types.GraphEdge, 0)
	for _, e := range graph.Edges {
		_, srcOk := sampledNodeIds[e.Source]
		_, tgtOk := sampledNodeIds[e.Target]
		if srcOk && tgtOk {
			edges = append(edges, e)
		}
	}

	hyperedges := survivingHyperedges(graph.Hyperedges, sampledNodeIds)

	communities := make([]types.GraphCommunity, 0)
	for _, c := range graph.Communities {
		filteredIds := make([]string, 0)
		for _, nid := range c.NodeIDs {
			if _, ok := sampledNodeIds[nid]; ok {
				filteredIds = append(filteredIds, nid)
			}
		}
		if len(filteredIds) > 0 {
			newC := c
			newC.NodeIDs = filteredIds
			communities = append(communities, newC)
		}
	}

	newGraph := graph
	newGraph.Nodes = nodes
	newGraph.Edges = edges
	newGraph.Hyperedges = hyperedges
	newGraph.Communities = communities

	return ViewerGraphArtifact{
		GraphArtifact: newGraph,
		Presentation: ViewerGraphPresentation{
			Mode:                 "overview",
			Threshold:            threshold,
			NodeBudget:           nodeBudget,
			TotalNodes:           len(graph.Nodes),
			DisplayedNodes:       len(nodes),
			TotalEdges:           len(graph.Edges),
			DisplayedEdges:       len(edges),
			TotalCommunities:     totalCommunities,
			DisplayedCommunities: len(communities),
		},
	}
}
