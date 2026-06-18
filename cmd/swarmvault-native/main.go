package main

import (
	"encoding/json"
	"fmt"
	"os"
	"swarmvault-native/internal/auto-commit"
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

func main() {
	if len(os.Args) > 1 && os.Args[1] == "auto-commit" {
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
	} else {
		fmt.Fprintf(os.Stderr, "Unknown command\n")
		os.Exit(1)
	}
}
