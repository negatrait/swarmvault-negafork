package parser

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type Fixtures struct {
	EstimateTokens []struct {
		Input    string `json:"input"`
		Expected int    `json:"expected"`
	} `json:"estimateTokens"`
	EstimatePageTokens []struct {
		Input struct {
			PageID     string   `json:"pageId"`
			Path       string   `json:"path"`
			Kind       string   `json:"kind"`
			Content    string   `json:"content"`
			NodeDegree *float64 `json:"nodeDegree,omitempty"`
			Confidence *float64 `json:"confidence,omitempty"`
		} `json:"input"`
		Expected PageTokenEstimate `json:"expected"`
	} `json:"estimatePageTokens"`
	TrimToTokenBudget []struct {
		Input struct {
			Pages     []PageTokenEstimate `json:"pages"`
			MaxTokens int                 `json:"maxTokens"`
		} `json:"input"`
		Expected TokenBudgetResult `json:"expected"`
	} `json:"trimToTokenBudget"`
}

func loadFixtures(t *testing.T) Fixtures {
	path := filepath.Join("..", "..", "packages", "engine", "test", "shared-fixtures", "token-estimation.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("Failed to read fixtures: %v", err)
	}

	var fixtures Fixtures
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatalf("Failed to parse fixtures: %v", err)
	}

	return fixtures
}

func TestEstimateTokens(t *testing.T) {
	fixtures := loadFixtures(t)

	for i, tc := range fixtures.EstimateTokens {
		result := EstimateTokens(tc.Input)
		if result != tc.Expected {
			t.Errorf("EstimateTokens[%d] = %d; want %d (input: %q)", i, result, tc.Expected, tc.Input)
		}
	}
}

func TestEstimatePageTokens(t *testing.T) {
	fixtures := loadFixtures(t)

	for i, tc := range fixtures.EstimatePageTokens {
		result := EstimatePageTokens(
			tc.Input.PageID,
			tc.Input.Path,
			tc.Input.Kind,
			tc.Input.Content,
			tc.Input.NodeDegree,
			tc.Input.Confidence,
		)

		if result.Tokens != tc.Expected.Tokens {
			t.Errorf("EstimatePageTokens[%d].Tokens = %d; want %d", i, result.Tokens, tc.Expected.Tokens)
		}
		if result.Priority != tc.Expected.Priority {
			t.Errorf("EstimatePageTokens[%d].Priority = %f; want %f", i, result.Priority, tc.Expected.Priority)
		}
	}
}

func TestTrimToTokenBudget(t *testing.T) {
	fixtures := loadFixtures(t)

	for i, tc := range fixtures.TrimToTokenBudget {
		result := TrimToTokenBudget(tc.Input.Pages, tc.Input.MaxTokens)

		if result.TotalTokens != tc.Expected.TotalTokens {
			t.Errorf("TrimToTokenBudget[%d].TotalTokens = %d; want %d", i, result.TotalTokens, tc.Expected.TotalTokens)
		}
		if result.KeptTokens != tc.Expected.KeptTokens {
			t.Errorf("TrimToTokenBudget[%d].KeptTokens = %d; want %d", i, result.KeptTokens, tc.Expected.KeptTokens)
		}
		if result.BudgetTokens != tc.Expected.BudgetTokens {
			t.Errorf("TrimToTokenBudget[%d].BudgetTokens = %d; want %d", i, result.BudgetTokens, tc.Expected.BudgetTokens)
		}
		if len(result.Kept) != len(tc.Expected.Kept) {
			t.Errorf("TrimToTokenBudget[%d].Kept length = %d; want %d", i, len(result.Kept), len(tc.Expected.Kept))
		}
		if len(result.Dropped) != len(tc.Expected.Dropped) {
			t.Errorf("TrimToTokenBudget[%d].Dropped length = %d; want %d", i, len(result.Dropped), len(tc.Expected.Dropped))
		}
	}
}
