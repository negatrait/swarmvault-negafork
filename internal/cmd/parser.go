package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/parser"
	"swarmvault-native/internal/utils"
)

func HandleParser() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "estimateTokens":
		var args struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(parser.EstimateTokens(args.Text)); err != nil {
			return err
		}
	case "estimatePageTokens":
		var args struct {
			PageID     string   `json:"pageId"`
			Path       string   `json:"path"`
			Kind       string   `json:"kind"`
			Content    string   `json:"content"`
			NodeDegree *float64 `json:"nodeDegree"`
			Confidence *float64 `json:"confidence"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(parser.EstimatePageTokens(
			args.PageID,
			args.Path,
			args.Kind,
			args.Content,
			args.NodeDegree,
			args.Confidence,
		)); err != nil {
			return err
		}
	case "trimToTokenBudget":
		var args struct {
			Pages     []parser.PageTokenEstimate `json:"pages"`
			MaxTokens int                        `json:"maxTokens"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(parser.TrimToTokenBudget(args.Pages, args.MaxTokens)); err != nil {
			return err
		}
	case "tokenize":
		var args struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(parser.Tokenize(args.Text)); err != nil {
			return err
		}
	case "contentTokens":
		var args struct {
			Text      string `json:"text"`
			MinLength int    `json:"minLength"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(parser.ContentTokens(args.Text, args.MinLength)); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unknown parser action: %s", payload.Action)
	}

	return nil
}
