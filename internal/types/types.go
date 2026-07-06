package types

type GraphNode struct {
	ID         string   `json:"id"`
	Type       string   `json:"type"`
	Name       string   `json:"name"`
	Label      *string  `json:"label,omitempty"`
	Degree     *int     `json:"degree,omitempty"`
	Centrality *float64 `json:"centrality,omitempty"`
	BridgeScore *float64 `json:"bridgeScore,omitempty"`
	SourceClass *string  `json:"sourceClass,omitempty"`
}

type GraphPage struct {
	ID         string  `json:"id"`
	Kind       string  `json:"kind"`
	Title      string  `json:"title"`
	SourceType *string `json:"sourceType,omitempty"`
}

type GraphArtifact struct {
	Nodes []GraphNode `json:"nodes"`
	Pages []GraphPage `json:"pages"`
	Edges      []GraphEdge      `json:"edges"`
	Hyperedges []GraphHyperedge `json:"hyperedges"`
	Communities []GraphCommunity `json:"communities,omitempty"`
}

type ClaimStatus string

const (
	ClaimStatusExtracted  ClaimStatus = "extracted"
	ClaimStatusInferred   ClaimStatus = "inferred"
	ClaimStatusConflicted ClaimStatus = "conflicted"
	ClaimStatusStale      ClaimStatus = "stale"
)

type Polarity string

const (
	PolarityPositive Polarity = "positive"
	PolarityNegative Polarity = "negative"
	PolarityNeutral  Polarity = "neutral"
)

type SourceClaim struct {
	ID         string      `json:"id"`
	Text       string      `json:"text"`
	Confidence float64     `json:"confidence"`
	Status     ClaimStatus `json:"status"`
	Polarity   Polarity    `json:"polarity"`
	Citation   string      `json:"citation"`
}

type EvidenceClass string

const (
	EvidenceClassExtracted EvidenceClass = "extracted"
	EvidenceClassInferred  EvidenceClass = "inferred"
	EvidenceClassAmbiguous EvidenceClass = "ambiguous"
)

type GraphHyperedge struct {
	ID            string        `json:"id"`
	Label         string        `json:"label"`
	Relation      string        `json:"relation"`
	NodeIDs       []string      `json:"nodeIds"`
	EvidenceClass EvidenceClass `json:"evidenceClass"`
	Confidence    float64       `json:"confidence"`
	SourcePageIDs []string      `json:"sourcePageIds"`
	Why           string        `json:"why"`
}


type GraphEdge struct {
	ID       string `json:"id"`
	Source   string `json:"source"`
	Target   string `json:"target"`
	Relation string `json:"relation"`
}

type GraphCommunity struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	NodeIDs []string `json:"nodeIds"`
}

type GraphReportNode struct {
	NodeID string `json:"nodeId"`
}

type GraphReportConnection struct {
	SourceNodeID string `json:"sourceNodeId"`
	TargetNodeID string `json:"targetNodeId"`
}

type GraphReportArtifact struct {
	GodNodes              []GraphReportNode       `json:"godNodes"`
	BridgeNodes           []GraphReportNode       `json:"bridgeNodes"`
	SurprisingConnections []GraphReportConnection `json:"surprisingConnections"`
}
