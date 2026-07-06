package hooks

type GitHookTargetOptions struct {
	RepoPath string `json:"repoPath,omitempty"`
}

type GitHookStatus struct {
	RepoRoot     *string `json:"repoRoot"`
	PostCommit   string  `json:"postCommit"`
	PostCheckout string  `json:"postCheckout"`
}
