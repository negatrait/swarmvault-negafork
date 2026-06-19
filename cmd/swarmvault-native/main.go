package main

import (
	"encoding/json"
	"fmt"
	"os"
	"swarmvault-native/internal/agents"
	"swarmvault-native/internal/auto-commit"
	"swarmvault-native/internal/benchmark"
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

		case "agents":
			var payload struct {
				Action  string                     `json:"action"`
				RootDir string                     `json:"rootDir"`
				Agent   agents.AgentType           `json:"agent"`
				Options agents.InstallAgentOptions `json:"options"`
			}
			if err := json.NewDecoder(os.Stdin).Decode(&payload); err != nil {
				fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
				os.Exit(1)
			}
			switch payload.Action {
			case "installAgent":
				result, err := agents.InstallAgent(payload.RootDir, payload.Agent, payload.Options)
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error installing agent: %v\n", err)
					os.Exit(1)
				}
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
					os.Exit(1)
				}
			case "getAgentInstallStatus":
				result, err := agents.GetAgentInstallStatus(payload.RootDir, payload.Agent, payload.Options)
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error getting status: %v\n", err)
					os.Exit(1)
				}
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
					os.Exit(1)
				}
			case "installConfiguredAgents":
				result, err := agents.InstallConfiguredAgents(payload.RootDir)
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error installing configured agents: %v\n", err)
					os.Exit(1)
				}
				if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
					os.Exit(1)
				}
			default:
				fmt.Fprintf(os.Stderr, "Unknown agents action: %s\n", payload.Action)
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

		default:
			fmt.Fprintf(os.Stderr, "Unknown command\n")
			os.Exit(1)
		}
	} else {
		fmt.Fprintf(os.Stderr, "No command provided\n")
		os.Exit(1)
	}
}
