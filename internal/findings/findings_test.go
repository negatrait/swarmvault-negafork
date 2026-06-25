package findings

import (
	"testing"
)

func TestNormalizeFindingSeverity(t *testing.T) {
	tests := []struct {
		name     string
		input    any
		expected string
	}{
		{"not a string (number)", 123, "info"},
		{"not a string (nil)", nil, "info"},
		{"not a string (bool)", true, "info"},
		{"empty string", "", "info"},

		{"error variants - exact", "error", "error"},
		{"error variants - critical", "critical", "error"},
		{"error variants - fatal", "fatal", "error"},
		{"error variants - high", "high", "error"},
		{"error variants - severe", "severe", "error"},
		{"error variants - caps", "ERROR", "error"},
		{"error variants - padded", "  fatal  ", "error"},

		{"warning variants - exact", "warning", "warning"},
		{"warning variants - warn", "warn", "warning"},
		{"warning variants - medium", "medium", "warning"},
		{"warning variants - moderate", "moderate", "warning"},
		{"warning variants - caution", "caution", "warning"},
		{"warning variants - caps", "WARNING", "warning"},
		{"warning variants - padded", "  medium  ", "warning"},

		{"info variants - exact", "info", "info"},
		{"info variants - unknown", "unknown", "info"},
		{"info variants - random", "something_else", "info"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NormalizeFindingSeverity(tt.input)
			if result != tt.expected {
				t.Errorf("NormalizeFindingSeverity(%v) = %v; expected %v", tt.input, result, tt.expected)
			}
		})
	}
}
