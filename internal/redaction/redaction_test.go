package redaction

import (
	"testing"
)

func TestResolveRedactionPatterns(t *testing.T) {
	t.Run("resolves enabled with defaults", func(t *testing.T) {
		res, err := ResolveRedactionPatterns(nil)
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if !res.Enabled {
			t.Errorf("expected enabled to be true")
		}
		if res.Placeholder != DefaultPlaceholder {
			t.Errorf("expected placeholder to be %s, got %s", DefaultPlaceholder, res.Placeholder)
		}
		if len(res.Patterns) != len(DefaultRedactionPatterns) {
			t.Errorf("expected %d patterns, got %d", len(DefaultRedactionPatterns), len(res.Patterns))
		}
	})

	t.Run("disables redaction", func(t *testing.T) {
		enabled := false
		res, err := ResolveRedactionPatterns(&RedactionConfig{
			Enabled: &enabled,
		})
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if res.Enabled {
			t.Errorf("expected enabled to be false")
		}
		if len(res.Patterns) != 0 {
			t.Errorf("expected 0 patterns, got %d", len(res.Patterns))
		}
	})

	t.Run("allows custom patterns", func(t *testing.T) {
		useDefaults := false
		res, err := ResolveRedactionPatterns(&RedactionConfig{
			UseDefaults: &useDefaults,
			Patterns: []ConfiguredRedactionPattern{
				{
					ID:          "employee_id",
					Pattern:     `EMP-\d{6}`,
					Flags:       "gi",
					Description: "Internal employee identifier",
				},
			},
		})
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}
		if len(res.Patterns) != 1 {
			t.Fatalf("expected 1 pattern, got %d", len(res.Patterns))
		}
		if res.Patterns[0].ID != "employee_id" {
			t.Errorf("expected pattern ID employee_id, got %s", res.Patterns[0].ID)
		}
		if res.Patterns[0].Flags != "gi" {
			t.Errorf("expected pattern Flags gi, got %s", res.Patterns[0].Flags)
		}
	})
}
