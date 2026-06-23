package types

type GraphNode struct {
	ID         string   `json:"id"`
	Type       string   `json:"type"`
	Name       string   `json:"name"`
	Label      *string  `json:"label,omitempty"`
	Degree     *int     `json:"degree,omitempty"`
	Centrality *float64 `json:"centrality,omitempty"`
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
