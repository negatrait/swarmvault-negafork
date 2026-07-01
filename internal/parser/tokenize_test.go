package parser

import (
	"reflect"
	"testing"
)

func TestTokenize(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{"empty string", "", []string{}},
		{"only punctuation", "!!!", []string{}},
		{"spaces", "   ", []string{}},
		{"normal words", "hello world", []string{"hello", "world"}},
		{"hyphenated", "state-of-the-art", []string{"state-of-the-art"}},
		{"apostrophes", "don't you know", []string{"don", "you", "know"}},
		{"trailing hyphens", "-hello- world-", []string{"hello-", "world-"}}, // regex matches hello- and world-
		{"short words", "hi", []string{"hi"}},
		{"accents", "café", []string{"caf"}}, // é doesn't match a-z
		{"mixed", "react18 v1 12345 x-ray", []string{"react18", "v1", "12345", "x-ray"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Tokenize(tt.input)
			if len(got) == 0 && len(tt.expected) == 0 {
				return // both empty
			}
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("Tokenize(%q) = %v, want %v", tt.input, got, tt.expected)
			}
		})
	}
}

func TestContentTokens(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		minLength int
		expected  []string
	}{
		{"empty string", "", 4, []string{}},
		{"punctuation", "!!!", 4, []string{}},
		{"enforce default min length", "the cat barks", 4, []string{"barks"}},
		{"custom min length", "the cat barks", 3, []string{"the", "cat", "barks"}},
		{"hyphenated", "open-source software", 4, []string{"open-source", "software"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ContentTokens(tt.input, tt.minLength)
			if len(got) == 0 && len(tt.expected) == 0 {
				return // both empty
			}
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("ContentTokens(%q, %d) = %v, want %v", tt.input, tt.minLength, got, tt.expected)
			}
		})
	}
}
