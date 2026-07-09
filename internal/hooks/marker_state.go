package hooks

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type WatchStaleness struct {
	LastRunAt                   *string `json:"lastRunAt,omitempty"`
	LastRunSuccess              *bool   `json:"lastRunSuccess,omitempty"`
	PendingSemanticRefreshCount int     `json:"pendingSemanticRefreshCount"`
}

func artifactRootDir(cwd string) string {
	override := strings.TrimSpace(os.Getenv("SWARMVAULT_OUT"))
	if override == "" {
		absPath, _ := filepath.Abs(cwd)
		return absPath
	}
	if filepath.IsAbs(override) {
		return override
	}
	absPath, _ := filepath.Abs(filepath.Join(cwd, override))
	return absPath
}

func ReadWatchStaleness(cwd string) (*WatchStaleness, error) {
	watchDir := filepath.Join(artifactRootDir(cwd), "state", "watch")
	var lastRunAt *string
	var lastRunSuccess *bool
	pendingCount := 0
	found := false

	if raw, err := os.ReadFile(filepath.Join(watchDir, "status.json")); err == nil {
		var parsed struct {
			LastRun *struct {
				FinishedAt *string `json:"finishedAt"`
				Success    *bool   `json:"success"`
			} `json:"lastRun"`
		}
		if err := json.Unmarshal(raw, &parsed); err == nil && parsed.LastRun != nil {
			lastRunAt = parsed.LastRun.FinishedAt
			lastRunSuccess = parsed.LastRun.Success
		}
		found = true
	}

	if raw, err := os.ReadFile(filepath.Join(watchDir, "pending-semantic-refresh.json")); err == nil {
		var parsed []any
		if err := json.Unmarshal(raw, &parsed); err == nil {
			pendingCount = len(parsed)
			found = true
		}
	}

	if !found {
		return nil, nil
	}

	return &WatchStaleness{
		LastRunAt:                   lastRunAt,
		LastRunSuccess:              lastRunSuccess,
		PendingSemanticRefreshCount: pendingCount,
	}, nil
}
