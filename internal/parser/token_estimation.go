package parser

import (
	"math"
	"regexp"
	"sort"
	"strings"
)

var (
	codeLikeStarts = []string{"```", "- `", "import ", "export ", "const ", "function ", "class ", "def ", "fn "}
	bracketRegex   = regexp.MustCompile(`^\s*[{}[\]();]`)
	assignRegex    = regexp.MustCompile(`^\w+\s*[=:]\s*`)
)

// EstimateTokens uses a blended heuristic: ~4 chars/token for prose, ~3 chars/token for code.
func EstimateTokens(text string) int {
	if text == "" {
		return 0
	}

	codeChars := 0
	proseChars := 0

	lines := strings.Split(text, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		isCode := false
		for _, start := range codeLikeStarts {
			if strings.HasPrefix(trimmed, start) {
				isCode = true
				break
			}
		}

		if !isCode {
			if bracketRegex.MatchString(trimmed) || assignRegex.MatchString(trimmed) {
				isCode = true
			}
		}

		if isCode {
			codeChars += len(line)
		} else {
			proseChars += len(line)
		}
	}

	// Code: ~3 chars/token, Prose: ~4 chars/token
	return int(math.Ceil(float64(codeChars)/3.0 + float64(proseChars)/4.0))
}

var kindWeights = map[string]float64{
	"index":             10.0,
	"graph_report":      8.0,
	"module":            7.0,
	"concept":           6.0,
	"source":            5.0,
	"community_summary": 5.0,
	"entity":            4.0,
	"output":            3.0,
	"insight":           2.0,
}

// PageTokenEstimate maps 1:1 to TS PageTokenEstimate
type PageTokenEstimate struct {
	PageID   string  `json:"pageId"`
	Path     string  `json:"path"`
	Kind     string  `json:"kind"`
	Tokens   int     `json:"tokens"`
	Priority float64 `json:"priority"`
}

// TokenBudgetResult maps 1:1 to TS TokenBudgetResult
type TokenBudgetResult struct {
	Kept         []PageTokenEstimate `json:"kept"`
	Dropped      []PageTokenEstimate `json:"dropped"`
	TotalTokens  int                 `json:"totalTokens"`
	BudgetTokens int                 `json:"budgetTokens"`
	KeptTokens   int                 `json:"keptTokens"`
}

// EstimatePageTokens maps 1:1 to TS estimatePageTokens
func EstimatePageTokens(pageId, path, kind, content string, nodeDegree *float64, confidence *float64) PageTokenEstimate {
	tokens := EstimateTokens(content)

	kindWeight, exists := kindWeights[kind]
	if !exists {
		kindWeight = 1.0
	}

	degree := 0.0
	if nodeDegree != nil {
		degree = *nodeDegree
	}

	conf := 0.5
	if confidence != nil {
		conf = *confidence
	}

	priority := kindWeight * (1.0 + degree*0.1) * conf

	return PageTokenEstimate{
		PageID:   pageId,
		Path:     path,
		Kind:     kind,
		Tokens:   tokens,
		Priority: priority,
	}
}

// TrimToTokenBudget maps 1:1 to TS trimToTokenBudget
func TrimToTokenBudget(pages []PageTokenEstimate, maxTokens int) TokenBudgetResult {
	totalTokens := 0
	for _, p := range pages {
		totalTokens += p.Tokens
	}

	if totalTokens <= maxTokens {
		kept := make([]PageTokenEstimate, len(pages))
		copy(kept, pages)
		return TokenBudgetResult{
			Kept:         kept,
			Dropped:      make([]PageTokenEstimate, 0),
			TotalTokens:  totalTokens,
			BudgetTokens: maxTokens,
			KeptTokens:   totalTokens,
		}
	}

	// Sort by priority descending (highest priority kept first)
	sorted := make([]PageTokenEstimate, len(pages))
	copy(sorted, pages)

	// Stable sort to match TS behavior for ties
	sort.SliceStable(sorted, func(i, j int) bool {
		return sorted[i].Priority > sorted[j].Priority
	})

	kept := make([]PageTokenEstimate, 0)
	dropped := make([]PageTokenEstimate, 0)
	accumulated := 0

	for _, page := range sorted {
		if accumulated+page.Tokens <= maxTokens {
			kept = append(kept, page)
			accumulated += page.Tokens
		} else {
			dropped = append(dropped, page)
		}
	}

	return TokenBudgetResult{
		Kept:         kept,
		Dropped:      dropped,
		TotalTokens:  totalTokens,
		BudgetTokens: maxTokens,
		KeptTokens:   accumulated,
	}
}
