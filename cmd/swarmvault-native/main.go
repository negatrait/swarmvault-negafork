package main

import (
	"fmt"
	"os"
	cmdPkg "swarmvault-native/internal/cmd"
)

func main() {
	if len(os.Args) > 1 {
		cmd := os.Args[1]

		switch cmd {
		case "agents":
			cmdPkg.HandleAgents()

		case "auto-commit":
			cmdPkg.HandleAutoCommit()

		case "benchmark":
			cmdPkg.HandleBenchmark()

		case "candidate-promotion":
			cmdPkg.HandleCandidatePromotion()

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
