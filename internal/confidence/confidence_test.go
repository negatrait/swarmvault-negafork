package confidence

import (
	"encoding/json"
	"os"
	"path/filepath"
	"swarmvault-native/internal/types"
	"testing"
)

type Fixture struct {
	Name     string          `json:"name"`
	Action   string          `json:"action"`
	Args     json.RawMessage `json:"args"`
	Expected float64         `json:"expected"`
}

type NodeConfidenceArgs struct {
	SourceCount int `json:"sourceCount"`
}

type EdgeConfidenceArgs struct {
	Claims      []types.SourceClaim `json:"claims"`
	ConceptName string              `json:"conceptName"`
}

type ConflictConfidenceArgs struct {
	ClaimA types.SourceClaim `json:"claimA"`
	ClaimB types.SourceClaim `json:"claimB"`
}

func TestConfidenceWithFixtures(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Failed to get working directory: %v", err)
	}

	// Adjust path to point to workspace root
	fixturePath := filepath.Join(wd, "..", "..", "packages", "engine", "test", "shared-fixtures", "confidence.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("Failed to read fixture file: %v", err)
	}

	var fixtures []Fixture
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatalf("Failed to unmarshal fixtures: %v", err)
	}

	for _, fixture := range fixtures {
		t.Run(fixture.Name, func(t *testing.T) {
			switch fixture.Action {
			case "nodeConfidence":
				var args NodeConfidenceArgs
				if err := json.Unmarshal(fixture.Args, &args); err != nil {
					t.Fatalf("Failed to unmarshal args: %v", err)
				}
				result := NodeConfidence(args.SourceCount)
				if result != fixture.Expected {
					t.Errorf("Expected %v, got %v", fixture.Expected, result)
				}

			case "edgeConfidence":
				var args EdgeConfidenceArgs
				if err := json.Unmarshal(fixture.Args, &args); err != nil {
					t.Fatalf("Failed to unmarshal args: %v", err)
				}
				result := EdgeConfidence(args.Claims, args.ConceptName)
				if result != fixture.Expected {
					t.Errorf("Expected %v, got %v", fixture.Expected, result)
				}

			case "conflictConfidence":
				var args ConflictConfidenceArgs
				if err := json.Unmarshal(fixture.Args, &args); err != nil {
					t.Fatalf("Failed to unmarshal args: %v", err)
				}
				result := ConflictConfidence(args.ClaimA, args.ClaimB)
				if result != fixture.Expected {
					t.Errorf("Expected %v, got %v", fixture.Expected, result)
				}

			default:
				t.Fatalf("Unknown action: %s", fixture.Action)
			}
		})
	}
}
