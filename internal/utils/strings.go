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
			if json.Valid([]byte(candidate)) {
				return candidate, nil
			}

			// Move end back to the previous '}'
			prevEnd := strings.LastIndex(text[:end], "}")
			if prevEnd == -1 {
				break
			}
			end = prevEnd
		}
	}

	return "", errors.New("Could not locate JSON object in provider response.")
}

func SafeFrontmatter(value map[string]json.RawMessage) map[string]json.RawMessage {
	return value
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
