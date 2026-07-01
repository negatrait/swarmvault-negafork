package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/chat"
	"swarmvault-native/internal/utils"
)

func HandleChat() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "listChatSessions":
		var args struct {
			RootDir string `json:"rootDir"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := chat.ListChatSessions(args.RootDir)
		if err != nil {
			return err
		}
		if result == nil {
			result = make([]chat.VaultChatSessionSummary, 0)
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "readChatSession":
		var args struct {
			RootDir    string `json:"rootDir"`
			IdOrPrefix string `json:"idOrPrefix"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := chat.ReadChatSession(args.RootDir, args.IdOrPrefix)
		if err != nil {
			return err
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "deleteChatSession":
		var args struct {
			RootDir    string `json:"rootDir"`
			IdOrPrefix string `json:"idOrPrefix"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := chat.DeleteChatSession(args.RootDir, args.IdOrPrefix)
		if err != nil {
			return err
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "askChatSessionPrepare":
		var args struct {
			RootDir string              `json:"rootDir"`
			Options chat.AskChatOptions `json:"options"`
			Now     string              `json:"now"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		session, prompt, err := chat.PrepareChatSession(args.RootDir, args.Options, args.Now)
		if err != nil {
			return err
		}

		result := struct {
			Session chat.VaultChatSession `json:"session"`
			Prompt  string                `json:"prompt"`
		}{
			Session: session,
			Prompt:  prompt,
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
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
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := chat.SaveChatSessionTurn(args.RootDir, args.Session, args.Options, args.QueryResult, args.Now)
		if err != nil {
			return err
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	default:
		return fmt.Errorf("unknown chat action: %s", payload.Action)
	}

	return nil
}
