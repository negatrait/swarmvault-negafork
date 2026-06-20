package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	candidatepromotion "swarmvault-native/internal/candidate-promotion"
)

func HandleCandidatePromotion() {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := json.NewDecoder(os.Stdin).Decode(&payload); err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
		os.Exit(1)
	}

	switch payload.Action {
	case "evaluateCandidateForPromotion":
		var args struct {
			Page    candidatepromotion.GraphPage                        `json:"page"`
			Graph   candidatepromotion.GraphArtifact                    `json:"graph"`
			History map[string]candidatepromotion.CandidateHistoryEntry `json:"history"`
			Config  candidatepromotion.CandidatePromotionConfig         `json:"config"`
			Now     int64                                               `json:"now"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := candidatepromotion.EvaluateCandidateForPromotion(args.Page, args.Graph, args.History, args.Config, args.Now)
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	case "sortDecisionsForPromotion":
		var args struct {
			Decisions []candidatepromotion.PromotionDecision `json:"decisions"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := candidatepromotion.SortDecisionsForPromotion(args.Decisions)
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	case "renderPromotionSessionMarkdown":
		var args struct {
			Decisions       []candidatepromotion.PromotionDecision `json:"decisions"`
			PromotedPageIds []string                               `json:"promotedPageIds"`
			Options         struct {
				DryRun     bool   `json:"dryRun"`
				StartedAt  string `json:"startedAt"`
				FinishedAt string `json:"finishedAt"`
			} `json:"options"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := candidatepromotion.RenderPromotionSessionMarkdown(args.Decisions, args.PromotedPageIds, args.Options.DryRun, args.Options.StartedAt, args.Options.FinishedAt)
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown candidate-promotion action: %s\n", payload.Action)
		os.Exit(1)
	}
}
