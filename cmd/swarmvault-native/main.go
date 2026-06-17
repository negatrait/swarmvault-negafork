package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

func main() {
	// Read all data from stdin
	inputData, err := io.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading from stdin: %v\n", err)
		os.Exit(1)
	}

	// If no data was provided, just exit cleanly
	if len(inputData) == 0 {
		return
	}

	// Try to unmarshal the JSON to ensure it's valid
	var payload json.RawMessage
	err = json.Unmarshal(inputData, &payload)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
		os.Exit(1)
	}

	// Marshal it back to stdout
	// We use json.Marshal to ensure it's a tight valid JSON output,
	// though we could theoretically just print `inputData` directly.
	outputData, err := json.Marshal(payload)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error encoding JSON: %v\n", err)
		os.Exit(1)
	}

	// Write the resulting JSON to stdout
	_, err = os.Stdout.Write(outputData)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error writing to stdout: %v\n", err)
		os.Exit(1)
	}
}
