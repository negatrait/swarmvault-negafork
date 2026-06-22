package utils

import (
	"encoding/json"
	"fmt"
	"os"
)

// DecodePayload reads from Stdin into the given struct
func DecodePayload(payload interface{}) error {
	if err := json.NewDecoder(os.Stdin).Decode(payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}
	return nil
}

// EncodeResponse writes a JSON struct to Stdout
func EncodeResponse(result interface{}) error {
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		return fmt.Errorf("error encoding JSON: %w", err)
	}
	return nil
}
