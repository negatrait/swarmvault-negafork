package chat

type OutputFormat string

const (
	OutputFormatMarkdown OutputFormat = "markdown"
	OutputFormatJSON     OutputFormat = "json"
)

type VaultChatTurn struct {
	ID               string       `json:"id"`
	CreatedAt        string       `json:"createdAt"`
	Question         string       `json:"question"`
	Answer           string       `json:"answer"`
	Citations        []string     `json:"citations"`
	RelatedPageIDs   []string     `json:"relatedPageIds"`
	RelatedNodeIDs   []string     `json:"relatedNodeIds"`
	RelatedSourceIDs []string     `json:"relatedSourceIds"`
	OutputFormat     OutputFormat `json:"outputFormat"`
	SavedPath        *string      `json:"savedPath,omitempty"`
}

type VaultChatSession struct {
	ID           string          `json:"id"`
	Title        string          `json:"title"`
	CreatedAt    string          `json:"createdAt"`
	UpdatedAt    string          `json:"updatedAt"`
	RootDir      string          `json:"rootDir"`
	MarkdownPath string          `json:"markdownPath"`
	Turns        []VaultChatTurn `json:"turns"`
}

type VaultChatSessionSummary struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
	TurnCount    int    `json:"turnCount"`
	MarkdownPath string `json:"markdownPath"`
}

type AskChatOptions struct {
	Question        string        `json:"question"`
	SessionID       *string       `json:"sessionId,omitempty"`
	Title           *string       `json:"title,omitempty"`
	SaveOutput      *bool         `json:"saveOutput,omitempty"`
	Format          *OutputFormat `json:"format,omitempty"`
	GapFill         *bool         `json:"gapFill,omitempty"`
	MaxHistoryTurns *int          `json:"maxHistoryTurns,omitempty"`
}

type AskChatResult struct {
	Session      VaultChatSession `json:"session"`
	Turn         VaultChatTurn    `json:"turn"`
	Answer       string           `json:"answer"`
	MarkdownPath string           `json:"markdownPath"`
	StatePath    string           `json:"statePath"`
	Resumed      bool             `json:"resumed"`
}

type QueryResult struct {
	Answer           string       `json:"answer"`
	Citations        []string     `json:"citations"`
	RelatedPageIDs   []string     `json:"relatedPageIds"`
	RelatedNodeIDs   []string     `json:"relatedNodeIds"`
	RelatedSourceIDs []string     `json:"relatedSourceIds"`
	OutputFormat     OutputFormat `json:"outputFormat"`
	SavedPath        *string      `json:"savedPath,omitempty"`
}
