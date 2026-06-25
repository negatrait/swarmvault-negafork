package cmd

import (
	"fmt"
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

func HandleAutoCommit() error {
	var payload AutoCommitPayload

	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	message, err := autocommit.AutoCommitWikiChanges(payload.RootDir, payload.Operation, payload.Detail, payload.Config, payload.Options)
	if err != nil {
		return err
	}

	result := OutputPayload{Message: message}
	if err := utils.EncodeResponse(result); err != nil {
		return err
	}
	return nil
}
