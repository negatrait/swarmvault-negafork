package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"swarmvault-native/internal/benchmark"
	"swarmvault-native/internal/utils"
)

type BenchmarkPayload struct {
	Action string          `json:"action"`
	Args   json.RawMessage `json:"args"`
}

func HandleBenchmark() {
	var payload BenchmarkPayload
	if err := utils.DecodePayload(&payload); err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
		os.Exit(1)
	}

	switch payload.Action {
	case "estimateTokens":
		var args struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := benchmark.EstimateTokens(args.Text)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	case "estimateCorpusWords":
		var args struct {
			Texts []string `json:"texts"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := benchmark.EstimateCorpusWords(args.Texts)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	case "benchmarkQueryTokens":
		var args struct {
			Graph            benchmark.GraphArtifact    `json:"graph"`
			QueryResult      benchmark.GraphQueryResult `json:"queryResult"`
			PageContentsById map[string]string          `json:"pageContentsById"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := benchmark.BenchmarkQueryTokens(&args.Graph, args.QueryResult, args.PageContentsById)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	case "graphHash":
		var args struct {
			Graph benchmark.GraphArtifact `json:"graph"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := benchmark.GraphHash(&args.Graph)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	case "defaultBenchmarkQuestionsForGraph":
		var args struct {
			Graph        benchmark.GraphArtifact `json:"graph"`
			MaxQuestions int                     `json:"maxQuestions"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := benchmark.DefaultBenchmarkQuestionsForGraph(&args.Graph, args.MaxQuestions)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	case "buildBenchmarkByClass":
		var args benchmark.BuildBenchmarkByClassInput
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := benchmark.BuildBenchmarkByClass(args)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	case "buildBenchmarkArtifact":
		var args benchmark.BuildBenchmarkArtifactInput
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := benchmark.BuildBenchmarkArtifact(args)
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown benchmark action: %s\n", payload.Action)
		os.Exit(1)
	}
}
