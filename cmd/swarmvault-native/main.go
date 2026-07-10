package main

import (
	"fmt"
	"os"
	"swarmvault-native/internal/cmd"
)

func main() {
	// Hand off all execution to the CLI package
	if err := cmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Execution failed: %v\n", err)
		os.Exit(1)
	}
}
