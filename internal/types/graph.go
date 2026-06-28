package types

type GraphNode struct {
	ID             string       `json:"id"`
	Type           string       `json:"type"`
	Label          string       `json:"label"`
	NormLabel      *string      `json:"normLabel,omitempty"`
	PageID         *string      `json:"pageId,omitempty"`
	Freshness      *string      `json:"freshness,omitempty"`
	Confidence     *float64     `json:"confidence,omitempty"`
	SourceIDs      []string     `json:"sourceIds"`
	ProjectIDs     []string     `json:"projectIds"`
	SourceClass    *SourceClass `json:"sourceClass,omitempty"`
	Language       *string      `json:"language,omitempty"`
	ModuleID       *string      `json:"moduleId,omitempty"`
	SymbolKind     *string      `json:"symbolKind,omitempty"`
	StartLine      *int         `json:"startLine,omitempty"`
	EndLine        *int         `json:"endLine,omitempty"`
	CommunityID    *string      `json:"communityId,omitempty"`
	Degree         *int         `json:"degree,omitempty"`
	BridgeScore    *float64     `json:"bridgeScore,omitempty"`
	IsGodNode      *bool        `json:"isGodNode,omitempty"`
	SurpriseReason *string      `json:"surpriseReason,omitempty"`
	Tags           []string     `json:"tags,omitempty"`
}

type GraphEdge struct {
	ID                string   `json:"id"`
	Source            string   `json:"source"`
	Target            string   `json:"target"`
	Relation          string   `json:"relation"`
	Status            string   `json:"status"`
	EvidenceClass     string   `json:"evidenceClass"`
	Confidence        float64  `json:"confidence"`
	Provenance        []string `json:"provenance"`
	SimilarityReasons []string `json:"similarityReasons,omitempty"`
	SimilarityBasis   *string  `json:"similarityBasis,omitempty"`
}

type GraphHyperedge struct {
	ID            string   `json:"id"`
	Label         string   `json:"label"`
	Relation      string   `json:"relation"`
	EvidenceClass string   `json:"evidenceClass"`
	Confidence    float64  `json:"confidence"`
	Why           string   `json:"why"`
	NodeIDs       []string `json:"nodeIds"`
	SourcePageIDs []string `json:"sourcePageIds"`
}

type GraphCommunity struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	NodeIDs []string `json:"nodeIds"`
}

type GraphPage struct {
	ID          string       `json:"id"`
	Path        string       `json:"path"`
	Title       string       `json:"title"`
	SourceClass *SourceClass `json:"sourceClass,omitempty"`
}

type GraphArtifact struct {
	GeneratedAt string           `json:"generatedAt"`
	Nodes       []GraphNode      `json:"nodes"`
	Edges       []GraphEdge      `json:"edges"`
	Hyperedges  []GraphHyperedge `json:"hyperedges"`
	Communities []GraphCommunity `json:"communities,omitempty"`
	Sources     []SourceManifest `json:"sources"`
	Pages       []GraphPage      `json:"pages"`
}

type GraphPushCounts struct {
	Sources       int `json:"sources"`
	Pages         int `json:"pages"`
	Nodes         int `json:"nodes"`
	Relationships int `json:"relationships"`
	Hyperedges    int `json:"hyperedges"`
	GroupMembers  int `json:"groupMembers"`
}
