package parser

import (
	"regexp"
	"strings"
)

var tokenizeRegex = regexp.MustCompile(`[a-z0-9][a-z0-9-]{1,}`)

// Tokenize returns lowercase term strings using a narrow regex fallback
// replacing the ad-hoc style regex tokenization that used to live in analysis.ts and search.ts.
// Since the 'compromise' NLP is not easily replicated, we use the fallback regex:
// [a-z0-9][a-z0-9-]{1,}
func Tokenize(text string) []string {
	lower := strings.ToLower(text)

	matches := tokenizeRegex.FindAllString(lower, -1)
	if matches == nil {
		return make([]string, 0)
	}

	return matches
}

// ContentTokens returns tokens suitable for content analysis
// enforcing a minimum length (default 4 if 0 is passed).
func ContentTokens(text string, minLength int) []string {
	if minLength == 0 {
		minLength = 4
	}

	allTokens := Tokenize(text)
	tokens := make([]string, 0, len(allTokens))
	for _, token := range allTokens {
		if len(token) >= minLength {
			tokens = append(tokens, token)
		}
	}
	return tokens
}
