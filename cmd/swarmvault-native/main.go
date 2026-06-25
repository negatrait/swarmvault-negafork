package main

import (
	"log"
	"swarmvault-native/internal/cmd"
)

func main() {
	// Hand off all execution to the CLI package
	if err := cmd.Execute(); err != nil {
		log.Fatalf("Execution failed: %v", err)
	}
}
