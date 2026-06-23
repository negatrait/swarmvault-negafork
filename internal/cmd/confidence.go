package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"swarmvault-native/internal/confidence"
	"swarmvault-native/internal/types"
	"swarmvault-native/internal/utils"
)

func HandleConfidence() {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
		os.Exit(1)
	}

	switch payload.Action {
	case "nodeConfidence":
		var args struct {
			SourceCount int `json:"sourceCount"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := confidence.NodeConfidence(args.SourceCount)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	case "edgeConfidence":
		var args struct {
			Claims      []types.SourceClaim `json:"claims"`
			ConceptName string              `json:"conceptName"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := confidence.EdgeConfidence(args.Claims, args.ConceptName)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	case "conflictConfidence":
		var args struct {
			ClaimA types.SourceClaim `json:"claimA"`
			ClaimB types.SourceClaim `json:"claimB"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := confidence.ConflictConfidence(args.ClaimA, args.ClaimB)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown confidence action: %s\n", payload.Action)
		os.Exit(1)
	}
}
