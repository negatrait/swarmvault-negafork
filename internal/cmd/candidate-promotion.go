package cmd

import (
	"encoding/json"
	"fmt"
	candidatepromotion "swarmvault-native/internal/candidate-promotion"
	"swarmvault-native/internal/utils"
)

func HandleCandidatePromotion() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
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
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := candidatepromotion.EvaluateCandidateForPromotion(args.Page, args.Graph, args.History, args.Config, args.Now)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "sortDecisionsForPromotion":
		var args struct {
			Decisions []candidatepromotion.PromotionDecision `json:"decisions"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := candidatepromotion.SortDecisionsForPromotion(args.Decisions)
		if err := utils.EncodeResponse(result); err != nil {
			return err
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
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := candidatepromotion.RenderPromotionSessionMarkdown(args.Decisions, args.PromotedPageIds, args.Options.DryRun, args.Options.StartedAt, args.Options.FinishedAt)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	default:
		return fmt.Errorf("unknown candidate-promotion action: %s", payload.Action)
	}

	return nil
}
