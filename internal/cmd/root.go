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
		HandleAgents()
		return nil
	case "auto-commit":
		HandleAutoCommit()
		return nil
	case "benchmark":
		HandleBenchmark()
		return nil
	case "candidate-promotion":
		HandleCandidatePromotion()
		return nil
	case "utils":
		HandleUtils()
		return nil
	case "chat":
		HandleChat()
		return nil
	case "confidence":
		HandleConfidence()
		return nil
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
