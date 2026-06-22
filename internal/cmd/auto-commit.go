package cmd

import (
	"fmt"
	"os"
	autocommit "swarmvault-native/internal/auto-commit"
	"swarmvault-native/internal/utils"
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

func HandleAutoCommit() {
	var payload AutoCommitPayload

	if err := utils.DecodePayload(&payload); err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
		os.Exit(1)
	}

	message, err := autocommit.AutoCommitWikiChanges(payload.RootDir, payload.Operation, payload.Detail, payload.Config, payload.Options)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error auto-committing: %v\n", err)
		os.Exit(1)
	}

	result := OutputPayload{Message: message}
	if err := utils.EncodeResponse(result); err != nil {
		os.Exit(1)
	}
}
