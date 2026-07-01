package utils

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

var whitespaceRegex = regexp.MustCompile(`\s+`)

func NormalizeWhitespace(value string) string {
	return strings.TrimSpace(whitespaceRegex.ReplaceAllString(value, " "))
}

var nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9]+`)
var leadingTrailingHyphensRegex = regexp.MustCompile(`^-+|-+$`)
var markdownJsonFenceRegex = regexp.MustCompile(`(?i)\x60\x60\x60json\s*([\s\S]*?)\x60\x60\x60`)

func Slugify(value string) string {
	lowered := strings.ToLower(value)
	replaced := nonAlphanumericRegex.ReplaceAllString(lowered, "-")
	trimmed := leadingTrailingHyphensRegex.ReplaceAllString(replaced, "")

	if len(trimmed) > 80 {
		trimmed = trimmed[:80]
	}

	if trimmed == "" {
		return "item"
	}
	return trimmed
}

func FirstSentences(value string, count int) string {
	normalized := whitespaceRegex.ReplaceAllString(value, " ")
	return firstSentencesManual(normalized, count)
}

func firstSentencesManual(text string, count int) string {
	var sentences []string
	start := 0

	for i := 0; i < len(text); i++ {
		// Look for punctuation followed by space
		if (text[i] == '.' || text[i] == '!' || text[i] == '?') && i+1 < len(text) && text[i+1] == ' ' {
			sentence := strings.TrimSpace(text[start : i+1])
			if sentence != "" {
				sentences = append(sentences, sentence)
			}
			// Skip the space(s)
			start = i + 1
			for start < len(text) && text[start] == ' ' {
				start++
			}
			i = start - 1
		}
	}

	// Add remaining text as the last sentence
	if start < len(text) {
		sentence := strings.TrimSpace(text[start:])
		if sentence != "" {
			sentences = append(sentences, sentence)
		}
	}

	limit := count
	if len(sentences) < limit {
		limit = len(sentences)
	}

	return strings.TrimSpace(strings.Join(sentences[:limit], " "))
}

func ExtractJson(text string) (string, error) {
	matches := markdownJsonFenceRegex.FindStringSubmatch(text)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1]), nil
	}

	start := strings.Index(text, "{")
	if start != -1 {
		end := strings.LastIndex(text, "}")
		for end > start {
			candidate := text[start : end+1]
			var dummy map[string]any
			if err := json.Unmarshal([]byte(candidate), &dummy); err == nil {
				return candidate, nil
			}
			// Search for next `}` before current end
			end = strings.LastIndex(text[:end], "}")
		}
	}

	return "", errors.New("Could not locate JSON object in provider response.")
}

func SafeFrontmatter(value map[string]any) map[string]any {
	// Re-encode via JSON to drop nil/undefined values to simulate JSON.parse(JSON.stringify(value))
	data, err := json.Marshal(value)
	if err != nil {
		return value
	}

	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return value
	}
	return result
}

func Truncate(value string, maxLength int) string {
	if len(value) <= maxLength {
		return value
	}
	if maxLength < 4 {
		return value[:maxLength]
	}
	return value[:maxLength-3] + "..."
}
