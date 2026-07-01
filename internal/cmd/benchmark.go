package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/benchmark"
	"swarmvault-native/internal/utils"
)

type BenchmarkPayload struct {
	Action string          `json:"action"`
	Args   json.RawMessage `json:"args"`
}

func HandleBenchmark() error {
	var payload BenchmarkPayload
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
		result := benchmark.EstimateTokens(args.Text)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "estimateCorpusWords":
		var args struct {
			Texts []string `json:"texts"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := benchmark.EstimateCorpusWords(args.Texts)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "benchmarkQueryTokens":
		var args struct {
			Graph            benchmark.GraphArtifact    `json:"graph"`
			QueryResult      benchmark.GraphQueryResult `json:"queryResult"`
			PageContentsById map[string]string          `json:"pageContentsById"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := benchmark.BenchmarkQueryTokens(&args.Graph, args.QueryResult, args.PageContentsById)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "graphHash":
		var args struct {
			Graph benchmark.GraphArtifact `json:"graph"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := benchmark.GraphHash(&args.Graph)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "defaultBenchmarkQuestionsForGraph":
		var args struct {
			Graph        benchmark.GraphArtifact `json:"graph"`
			MaxQuestions int                     `json:"maxQuestions"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := benchmark.DefaultBenchmarkQuestionsForGraph(&args.Graph, args.MaxQuestions)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "buildBenchmarkByClass":
		var args benchmark.BuildBenchmarkByClassInput
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := benchmark.BuildBenchmarkByClass(args)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "buildBenchmarkArtifact":
		var args benchmark.BuildBenchmarkArtifactInput
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := benchmark.BuildBenchmarkArtifact(args)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	default:
		return fmt.Errorf("unknown benchmark action: %s", payload.Action)
	}

	return nil
}
