package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"swarmvault-native/internal/chat"
)

func HandleChat() {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := json.NewDecoder(os.Stdin).Decode(&payload); err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
		os.Exit(1)
	}

	switch payload.Action {
	case "listChatSessions":
		var args struct {
			RootDir string `json:"rootDir"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := chat.ListChatSessions(args.RootDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error listing chat sessions: %v\n", err)
			os.Exit(1)
		}
		if result == nil {
			result = make([]chat.VaultChatSessionSummary, 0)
		}
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	case "readChatSession":
		var args struct {
			RootDir    string `json:"rootDir"`
			IdOrPrefix string `json:"idOrPrefix"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := chat.ReadChatSession(args.RootDir, args.IdOrPrefix)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading chat session: %v\n", err)
			os.Exit(1)
		}
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	case "deleteChatSession":
		var args struct {
			RootDir    string `json:"rootDir"`
			IdOrPrefix string `json:"idOrPrefix"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := chat.DeleteChatSession(args.RootDir, args.IdOrPrefix)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error deleting chat session: %v\n", err)
			os.Exit(1)
		}
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	case "askChatSessionPrepare":
		var args struct {
			RootDir string              `json:"rootDir"`
			Options chat.AskChatOptions `json:"options"`
			Now     string              `json:"now"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		session, prompt, err := chat.PrepareChatSession(args.RootDir, args.Options, args.Now)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error preparing chat session: %v\n", err)
			os.Exit(1)
		}

		result := struct {
			Session chat.VaultChatSession `json:"session"`
			Prompt  string                `json:"prompt"`
		}{
			Session: session,
			Prompt:  prompt,
		}
		if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
			os.Exit(1)
		}

	case "askChatSessionSave":
		var args struct {
			RootDir     string                `json:"rootDir"`
			Session     chat.VaultChatSession `json:"session"`
			Options     chat.AskChatOptions   `json:"options"`
			QueryResult chat.QueryResult      `json:"queryResult"`
			Now         string                `json:"now"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := chat.SaveChatSessionTurn(args.RootDir, args.Session, args.Options, args.QueryResult, args.Now)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error saving chat session turn: %v\n", err)
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
