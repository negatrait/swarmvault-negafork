package utils

import (
	"encoding/json"
	"fmt"
	"os"
)

// ActionPayload is the standard payload structure for CLI commands
type ActionPayload struct {
	Action string          `json:"action"`
	Args   json.RawMessage `json:"args"`
}

// DecodePayload reads from Stdin into the given struct
func DecodePayload[T any](payload *T) error {
	if err := json.NewDecoder(os.Stdin).Decode(payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}
	return nil
}

// EncodeResponse writes a JSON struct to Stdout
func EncodeResponse[T any](result T) error {
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		return fmt.Errorf("error encoding JSON: %w", err)
	}
	return nil
}
