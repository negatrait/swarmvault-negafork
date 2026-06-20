package chat

type VaultChatTurn struct {
	ID               string   `json:"id"`
	CreatedAt        string   `json:"createdAt"`
	Question         string   `json:"question"`
	Answer           string   `json:"answer"`
	Citations        []string `json:"citations"`
	RelatedPageIds   []string `json:"relatedPageIds"`
	RelatedNodeIds   []string `json:"relatedNodeIds"`
	RelatedSourceIds []string `json:"relatedSourceIds"`
	OutputFormat     string   `json:"outputFormat"`
	SavedPath        *string  `json:"savedPath,omitempty"`
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
	Question        string  `json:"question"`
	SessionId       *string `json:"sessionId,omitempty"`
	Title           *string `json:"title,omitempty"`
	SaveOutput      *bool   `json:"saveOutput,omitempty"`
	Format          *string `json:"format,omitempty"`
	GapFill         *bool   `json:"gapFill,omitempty"`
	MaxHistoryTurns *int    `json:"maxHistoryTurns,omitempty"`
}

type AskChatResult struct {
	Session      VaultChatSession `json:"session"`
	Turn         VaultChatTurn    `json:"turn"`
	Answer       string           `json:"answer"`
	MarkdownPath string           `json:"markdownPath"`
	StatePath    string           `json:"statePath"`
	Resumed      bool             `json:"resumed"`
}

type ChatDirsPaths struct {
	StateDir string `json:"stateDir"`
	WikiDir  string `json:"wikiDir"`
}
