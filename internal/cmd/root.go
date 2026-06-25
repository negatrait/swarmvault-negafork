package cmd

import (
	"errors"
	"fmt"
	"os"
)

// Execute parses the subcommand and delegates to the correct file
func Execute() error {
	if len(os.Args) < 2 {
		printUsage()
		return errors.New("missing subcommand")
	}

	subcommand := os.Args[1]
	switch subcommand {
	case "agents":
		return HandleAgents()
	case "auto-commit":
		return HandleAutoCommit()
	case "benchmark":
		return HandleBenchmark()
	case "candidate-promotion":
		return HandleCandidatePromotion()
	case "utils":
		return HandleUtils()
	case "chat":
		return HandleChat()
	case "confidence":
		return HandleConfidence()
	default:
		printUsage()
		return fmt.Errorf("unknown subcommand: %s", subcommand)
	}
}

func printUsage() {
	fmt.Fprintln(os.Stderr, "Usage: swarmvault-native <subcommand> [args]")
	fmt.Fprintln(os.Stderr, "Subcommands:")
	fmt.Fprintln(os.Stderr, "  agents")
	fmt.Fprintln(os.Stderr, "  auto-commit")
	fmt.Fprintln(os.Stderr, "  benchmark")
	fmt.Fprintln(os.Stderr, "  candidate-promotion")
	fmt.Fprintln(os.Stderr, "  utils")
	fmt.Fprintln(os.Stderr, "  chat")
	fmt.Fprintln(os.Stderr, "  confidence")
}
