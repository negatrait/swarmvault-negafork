package types

type WebSearchProviderConfig struct {
	Type         string            `json:"type"`
	Endpoint     *string           `json:"endpoint,omitempty"`
	Method       *string           `json:"method,omitempty"`
	APIKeyEnv    *string           `json:"apiKeyEnv,omitempty"`
	APIKeyHeader *string           `json:"apiKeyHeader,omitempty"`
	APIKeyPrefix *string           `json:"apiKeyPrefix,omitempty"`
	Headers      map[string]string `json:"headers,omitempty"`
	QueryParam   *string           `json:"queryParam,omitempty"`
	LimitParam   *string           `json:"limitParam,omitempty"`
	ResultsPath  *string           `json:"resultsPath,omitempty"`
	TitleField   *string           `json:"titleField,omitempty"`
	URLField     *string           `json:"urlField,omitempty"`
	SnippetField *string           `json:"snippetField,omitempty"`
	Module       *string           `json:"module,omitempty"`
}

type WebSearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}
