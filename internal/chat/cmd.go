package chat

import (
	"encoding/json"
	"fmt"
	"os"
)

type ChatCommandPayload struct {
	Action     string          `json:"action"`
	RootDir    string          `json:"rootDir"`
	Paths      ChatDirsPaths   `json:"paths"`
	IDOrPrefix string          `json:"idOrPrefix,omitempty"`
	Options    *AskChatOptions `json:"options,omitempty"`
}

func HandleChatCommand() {
	var payload ChatCommandPayload
	if err := json.NewDecoder(os.Stdin).Decode(&payload); err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
		os.Exit(1)
	}

	switch payload.Action {
	case "listChatSessions":
		result, err := ListChatSessions(payload.RootDir, payload.Paths)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error listing chat sessions: %v\n", err)
			os.Exit(1)
		}
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	case "readChatSession":
		result, err := ReadChatSession(payload.RootDir, payload.Paths, payload.IDOrPrefix)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading chat session: %v\n", err)
			os.Exit(1)
		}
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	case "deleteChatSession":
		result, err := DeleteChatSession(payload.RootDir, payload.Paths, payload.IDOrPrefix)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error deleting chat session: %v\n", err)
			os.Exit(1)
		}
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	case "askChatSession":
		if payload.Options == nil {
			fmt.Fprintf(os.Stderr, "Error: options are required for askChatSession\n")
			os.Exit(1)
		}
		result, err := AskChatSession(payload.RootDir, payload.Paths, *payload.Options)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error asking chat session: %v\n", err)
			os.Exit(1)
		}
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown chat action: %s\n", payload.Action)
		os.Exit(1)
	}
}
