package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/confidence"
	"swarmvault-native/internal/types"
	"swarmvault-native/internal/utils"
)

func HandleConfidence() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "nodeConfidence":
		var args struct {
			SourceCount int `json:"sourceCount"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := confidence.NodeConfidence(args.SourceCount)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "edgeConfidence":
		var args struct {
			Claims      []types.SourceClaim `json:"claims"`
			ConceptName string              `json:"conceptName"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := confidence.EdgeConfidence(args.Claims, args.ConceptName)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "conflictConfidence":
		var args struct {
			ClaimA types.SourceClaim `json:"claimA"`
			ClaimB types.SourceClaim `json:"claimB"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := confidence.ConflictConfidence(args.ClaimA, args.ClaimB)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	default:
		return fmt.Errorf("unknown confidence action: %s", payload.Action)
	}

	return nil
}
