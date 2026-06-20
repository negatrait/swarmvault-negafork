package main

import (
	"encoding/json"
	"fmt"
	"os"
	autocommit "swarmvault-native/internal/auto-commit"
	"swarmvault-native/internal/benchmark"
	candidatepromotion "swarmvault-native/internal/candidate-promotion"
	cmdPkg "swarmvault-native/internal/cmd"
)

type AutoCommitPayload struct {
	RootDir   string                        `json:"rootDir"`
	Operation string                        `json:"operation"`
	Detail    string                        `json:"detail,omitempty"`
	Config    autocommit.VaultConfigPayload `json:"config"`
	Options   autocommit.AutoCommitOptions  `json:"options"`
}

type OutputPayload struct {
	Message *string `json:"message"`
}

type BenchmarkPayload struct {
	Action string          `json:"action"`
	Args   json.RawMessage `json:"args"`
}

func main() {
	if len(os.Args) > 1 {
		cmd := os.Args[1]

		switch cmd {
		case "auto-commit":
			var payload AutoCommitPayload

			if err := json.NewDecoder(os.Stdin).Decode(&payload); err != nil {
				fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
				os.Exit(1)
			}

			message, err := autocommit.AutoCommitWikiChanges(payload.RootDir, payload.Operation, payload.Detail, payload.Config, payload.Options)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error auto-committing: %v\n", err)
				os.Exit(1)
			}

			result := OutputPayload{Message: message}
			if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
				os.Exit(1)
			}

		case "benchmark":
			var payload BenchmarkPayload
			if err := json.NewDecoder(os.Stdin).Decode(&payload); err != nil {
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
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
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
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
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
				result := benchmark.BenchmarkQueryTokens(args.Graph, args.QueryResult, args.PageContentsById)
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
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
				result := benchmark.GraphHash(args.Graph)
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
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
				result := benchmark.DefaultBenchmarkQuestionsForGraph(args.Graph, args.MaxQuestions)
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
					os.Exit(1)
				}

			case "buildBenchmarkByClass":
				var args benchmark.BuildBenchmarkByClassInput
				if err := json.Unmarshal(payload.Args, &args); err != nil {
					fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
					os.Exit(1)
				}
				result := benchmark.BuildBenchmarkByClass(args)
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
					os.Exit(1)
				}

			case "buildBenchmarkArtifact":
				var args benchmark.BuildBenchmarkArtifactInput
				if err := json.Unmarshal(payload.Args, &args); err != nil {
					fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
					os.Exit(1)
				}
				result := benchmark.BuildBenchmarkArtifact(args)
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
					os.Exit(1)
				}

			default:
				fmt.Fprintf(os.Stderr, "Unknown benchmark action: %s\n", payload.Action)
				os.Exit(1)
			}

		case "candidate-promotion":
			handleCandidatePromotion()

		case "chat":
			cmdPkg.HandleChat()

		default:
			fmt.Fprintf(os.Stderr, "Unknown command\n")
			os.Exit(1)
		}
	} else {
		fmt.Fprintf(os.Stderr, "No command provided\n")
		os.Exit(1)
	}
}

func handleCandidatePromotion() {
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
