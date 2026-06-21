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
