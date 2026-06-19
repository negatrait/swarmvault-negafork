package benchmark

type Freshness string

type SourceClass string

type EvidenceClass string

type CodeLanguage string

type CodeSymbolKind string

type ClaimStatus string

type SourceCaptureType string

type SourceKind string

type PageKind string

type GraphNode struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	Label       string          `json:"label"`
	NormLabel   *string         `json:"normLabel,omitempty"`
	PageID      *string         `json:"pageId,omitempty"`
	Freshness   *Freshness      `json:"freshness,omitempty"`
	Confidence  *float64        `json:"confidence,omitempty"`
	SourceIDs   []string        `json:"sourceIds"`
	ProjectIDs  []string        `json:"projectIds"`
	SourceClass *SourceClass    `json:"sourceClass,omitempty"`
	Language    *CodeLanguage   `json:"language,omitempty"`
	ModuleID    *string         `json:"moduleId,omitempty"`
	SymbolKind  *CodeSymbolKind `json:"symbolKind,omitempty"`
	StartLine   *int            `json:"startLine,omitempty"`
	EndLine     *int            `json:"endLine,omitempty"`
	CommunityID *string         `json:"communityId,omitempty"`
	Degree      *int            `json:"degree,omitempty"`
	BridgeScore *float64        `json:"bridgeScore,omitempty"`
	IsGodNode   *bool           `json:"isGodNode,omitempty"`
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
	SimilarityReasons *[]string     `json:"similarityReasons,omitempty"`
	SimilarityBasis   *string       `json:"similarityBasis,omitempty"`
}

type GraphHyperedge struct {
	ID            string        `json:"id"`
	Label         string        `json:"label"`
	Relation      string        `json:"relation"`
	NodeIDs       []string      `json:"nodeIds"`
	EvidenceClass EvidenceClass `json:"evidenceClass"`
}

type SourceManifest struct {
	SourceID              string             `json:"sourceId"`
	Title                 string             `json:"title"`
	OriginType            string             `json:"originType"`
	SourceKind            SourceKind         `json:"sourceKind"`
	SourceType            *SourceCaptureType `json:"sourceType,omitempty"`
	SourceClass           *SourceClass       `json:"sourceClass,omitempty"`
	Language              *CodeLanguage      `json:"language,omitempty"`
	OriginalPath          *string            `json:"originalPath,omitempty"`
	RepoRelativePath      *string            `json:"repoRelativePath,omitempty"`
	URL                   *string            `json:"url,omitempty"`
	StoredPath            string             `json:"storedPath"`
	ExtractedTextPath     *string            `json:"extractedTextPath,omitempty"`
	ExtractedMetadataPath *string            `json:"extractedMetadataPath,omitempty"`
	ExtractionHash        *string            `json:"extractionHash,omitempty"`
	MimeType              string             `json:"mimeType"`
	ContentHash           string             `json:"contentHash"`
	SemanticHash          string             `json:"semanticHash"`
	SourceGroupID         *string            `json:"sourceGroupId,omitempty"`
	SourceGroupTitle      *string            `json:"sourceGroupTitle,omitempty"`
	SourcePartKey         *string            `json:"sourcePartKey,omitempty"`
}

type GraphPage struct {
	ID          string             `json:"id"`
	Path        string             `json:"path"`
	Title       string             `json:"title"`
	Kind        PageKind           `json:"kind"`
	Status      *string            `json:"status,omitempty"`
	SourceType  *SourceCaptureType `json:"sourceType,omitempty"`
	SourceClass *SourceClass       `json:"sourceClass,omitempty"`
	SourceIDs   []string           `json:"sourceIds"`
	ProjectIDs  []string           `json:"projectIds"`
	NodeIDs     []string           `json:"nodeIds"`
	Freshness   Freshness          `json:"freshness"`
	DecayScore  *float64           `json:"decayScore,omitempty"`
}

type GraphCommunity struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	NodeIDs []string `json:"nodeIds"`
}

type GraphArtifact struct {
	GeneratedAt string            `json:"generatedAt"`
	Nodes       []GraphNode       `json:"nodes"`
	Edges       []GraphEdge       `json:"edges"`
	Hyperedges  []GraphHyperedge  `json:"hyperedges"`
	Communities *[]GraphCommunity `json:"communities,omitempty"`
	Sources     []SourceManifest  `json:"sources"`
	Pages       []GraphPage       `json:"pages"`
}

type GraphQueryMatch struct {
	ID string `json:"id"`
}

type GraphQueryFilters struct {
	PageKind *string `json:"pageKind,omitempty"`
}

type GraphQueryFilterStats struct {
	Count int `json:"count"`
}

type GraphQueryResult struct {
	Question       string                 `json:"question"`
	Traversal      string                 `json:"traversal"`
	SeedNodeIDs    []string               `json:"seedNodeIds"`
	SeedPageIDs    []string               `json:"seedPageIds"`
	VisitedNodeIDs []string               `json:"visitedNodeIds"`
	VisitedEdgeIDs []string               `json:"visitedEdgeIds"`
	HyperedgeIDs   []string               `json:"hyperedgeIds"`
	PageIDs        []string               `json:"pageIds"`
	Communities    []string               `json:"communities"`
	Summary        string                 `json:"summary"`
	Matches        []GraphQueryMatch      `json:"matches"`
	TopMatchPage   *string                `json:"topMatchPagePath,omitempty"`
	Filters        *GraphQueryFilters     `json:"filters,omitempty"`
	FilterStats    *GraphQueryFilterStats `json:"filterStats,omitempty"`
}

type BenchmarkQuestionResult struct {
	Question       string   `json:"question"`
	QueryTokens    int      `json:"queryTokens"`
	Reduction      float64  `json:"reduction"`
	VisitedNodeIDs []string `json:"visitedNodeIds"`
	VisitedEdgeIDs []string `json:"visitedEdgeIds"`
	PageIDs        []string `json:"pageIds"`
}

type BenchmarkSummary struct {
	QuestionCount      int     `json:"questionCount"`
	UniqueVisitedNodes int     `json:"uniqueVisitedNodes"`
	FinalContextTokens int     `json:"finalContextTokens"`
	NaiveCorpusTokens  int     `json:"naiveCorpusTokens"`
	AvgReduction       float64 `json:"avgReduction"`
	ReductionRatio     float64 `json:"reductionRatio"`
}

type BenchmarkByClassEntry struct {
	SourceClass        SourceClass               `json:"sourceClass"`
	SourceCount        int                       `json:"sourceCount"`
	PageCount          int                       `json:"pageCount"`
	NodeCount          int                       `json:"nodeCount"`
	GodNodeCount       int                       `json:"godNodeCount"`
	CorpusWords        int                       `json:"corpusWords"`
	CorpusTokens       int                       `json:"corpusTokens"`
	FinalContextTokens int                       `json:"finalContextTokens"`
	ReductionRatio     float64                   `json:"reductionRatio"`
	PerQuestion        []BenchmarkQuestionResult `json:"perQuestion"`
}

type BenchmarkArtifact struct {
	GeneratedAt     string                                `json:"generatedAt"`
	GraphHash       string                                `json:"graphHash"`
	CorpusWords     int                                   `json:"corpusWords"`
	CorpusTokens    int                                   `json:"corpusTokens"`
	Nodes           int                                   `json:"nodes"`
	Edges           int                                   `json:"edges"`
	AvgQueryTokens  int                                   `json:"avgQueryTokens"`
	ReductionRatio  float64                               `json:"reductionRatio"`
	SampleQuestions []string                              `json:"sampleQuestions"`
	PerQuestion     []BenchmarkQuestionResult             `json:"perQuestion"`
	Summary         BenchmarkSummary                      `json:"summary"`
	ByClass         map[SourceClass]BenchmarkByClassEntry `json:"byClass"`
}
