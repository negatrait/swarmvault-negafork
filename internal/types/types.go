package types

type GraphNode struct {
	PageID      *string  `json:"pageId,omitempty"`
	ID          string   `json:"id"`
	Type        string   `json:"type"`
	Label       string   `json:"label"`
	Degree      *int     `json:"degree,omitempty"`
	Centrality  *float64 `json:"centrality,omitempty"`
	BridgeScore *float64 `json:"bridgeScore,omitempty"`
	SourceClass *string  `json:"sourceClass,omitempty"`
	SourceIDs   []string `json:"sourceIds"`
	ProjectIDs  []string `json:"projectIds"`
}

type Freshness string
type SourceClass string
type DecayConfig struct {
	HalfLifeDaysBySourceClass map[SourceClass]float64 `json:"halfLifeDaysBySourceClass,omitempty"`
	DefaultHalfLifeDays       *float64                `json:"defaultHalfLifeDays,omitempty"`
	StaleThreshold            *float64                `json:"staleThreshold,omitempty"`
}

type GraphPage struct {
	ID                      string            `json:"id"`
	Kind                    string            `json:"kind"`
	Title                   string            `json:"title"`
	SourceType              *string           `json:"sourceType,omitempty"`
	Path                    string            `json:"path"`
	SourceClass             *SourceClass      `json:"sourceClass,omitempty"`
	SourceIDs               []string          `json:"sourceIds"`
	ProjectIDs              []string          `json:"projectIds"`
	NodeIDs                 []string          `json:"nodeIds"`
	Freshness               Freshness         `json:"freshness"`
	DecayScore              *float64          `json:"decayScore,omitempty"`
	LastConfirmedAt         *string           `json:"lastConfirmedAt,omitempty"`
	SupersededBy            *string           `json:"supersededBy,omitempty"`
	Status                  string            `json:"status"`
	Confidence              float64           `json:"confidence,omitempty"`
	Backlinks               []string          `json:"backlinks,omitempty"`
	SchemaHash              string            `json:"schemaHash,omitempty"`
	SourceHashes            map[string]string `json:"sourceHashes,omitempty"`
	SourceSemanticHashes    map[string]string `json:"sourceSemanticHashes,omitempty"`
	RelatedPageIds          []string          `json:"relatedPageIds,omitempty"`
	RelatedNodeIds          []string          `json:"relatedNodeIds,omitempty"`
	RelatedSourceIds        []string          `json:"relatedSourceIds,omitempty"`
	CreatedAt               string            `json:"createdAt,omitempty"`
	UpdatedAt               string            `json:"updatedAt,omitempty"`
	CompiledFrom            []string          `json:"compiledFrom,omitempty"`
	ManagedBy               string            `json:"managedBy,omitempty"`
	Origin                  any               `json:"origin,omitempty"`
	Question                *string           `json:"question,omitempty"`
	OutputFormat            *string           `json:"outputFormat,omitempty"`
	OutputAssets            any               `json:"outputAssets,omitempty"`
	Tier                    *string           `json:"tier,omitempty"`
	ConsolidatedFromPageIds []string          `json:"consolidatedFromPageIds,omitempty"`
	ConsolidationConfidence *float64          `json:"consolidationConfidence,omitempty"`
}

type GraphArtifact struct {
	Nodes       []GraphNode      `json:"nodes"`
	Pages       []GraphPage      `json:"pages"`
	Edges       []GraphEdge      `json:"edges"`
	Hyperedges  []GraphHyperedge `json:"hyperedges"`
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
	ID                string        `json:"id"`
	Source            string        `json:"source"`
	Target            string        `json:"target"`
	Relation          string        `json:"relation"`
	Status            ClaimStatus   `json:"status"`
	EvidenceClass     EvidenceClass `json:"evidenceClass"`
	Confidence        float64       `json:"confidence"`
	Provenance        []string      `json:"provenance"`
	SimilarityReasons []string      `json:"similarityReasons,omitempty"`
	SimilarityBasis   string        `json:"similarityBasis,omitempty"`
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
