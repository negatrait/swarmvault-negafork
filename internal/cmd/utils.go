package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/utils"
)

func HandleUtils() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "slugify", "sha256", "toPosix", "firstSentences":
		return handleUtilsStringOpsBasic(payload.Action, payload.Args)
	case "extractJson", "normalizeWhitespace", "safeFrontmatter", "truncate":
		return handleUtilsStringOpsAdvanced(payload.Action, payload.Args)
	case "ensureDir", "fileExists", "readJsonFile", "writeJsonFile":
		return handleUtilsFsOpsBasic(payload.Action, payload.Args)
	case "appendJsonLine", "writeFileIfChanged", "isPathWithin", "listFilesRecursive":
		return handleUtilsFsOpsAdvanced(payload.Action, payload.Args)
	default:
		return fmt.Errorf("unknown utils action: %s", payload.Action)
	}
}

func handleUtilsStringOpsBasic(action string, rawArgs json.RawMessage) error {
	switch action {
	case "slugify":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(utils.Slugify(args.Value)); err != nil {
			return err
		}
	case "sha256":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(utils.Sha256String(args.Value)); err != nil {
			return err
		}
	case "toPosix":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(utils.ToPosix(args.Value)); err != nil {
			return err
		}
	case "firstSentences":
		var args struct {
			Value string `json:"value"`
			Count int    `json:"count"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(utils.FirstSentences(args.Value, args.Count)); err != nil {
			return err
		}
	}
	return nil
}

func handleUtilsStringOpsAdvanced(action string, rawArgs json.RawMessage) error {
	switch action {
	case "extractJson":
		var args struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := utils.ExtractJson(args.Text)
		if err != nil {
			return err
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	case "normalizeWhitespace":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(utils.NormalizeWhitespace(args.Value)); err != nil {
			return err
		}
	case "safeFrontmatter":
		var args struct {
			Value map[string]any `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(utils.SafeFrontmatter(args.Value)); err != nil {
			return err
		}
	case "truncate":
		var args struct {
			Value     string `json:"value"`
			MaxLength int    `json:"maxLength"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EncodeResponse(utils.Truncate(args.Value, args.MaxLength)); err != nil {
			return err
		}
	}
	return nil
}

func handleUtilsFsOpsBasic(action string, rawArgs json.RawMessage) error {
	switch action {
	case "ensureDir":
		var args struct {
			DirPath string `json:"dirPath"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.EnsureDir(args.DirPath); err != nil {
			return err
		}
		if err := utils.EncodeResponse(nil); err != nil {
			return err
		}
	case "fileExists":
		var args struct {
			FilePath string `json:"filePath"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := utils.FileExists(args.FilePath)
		if err != nil {
			return err
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	case "readJsonFile":
		var args struct {
			FilePath string `json:"filePath"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := utils.ReadJsonFile[json.RawMessage](args.FilePath)
		if err != nil {
			return err
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	case "writeJsonFile":
		var args struct {
			FilePath string          `json:"filePath"`
			Value    json.RawMessage `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.WriteJsonFile(args.FilePath, args.Value); err != nil {
			return err
		}
		if err := utils.EncodeResponse(nil); err != nil {
			return err
		}
	}
	return nil
}

func handleUtilsFsOpsAdvanced(action string, rawArgs json.RawMessage) error {
	switch action {
	case "appendJsonLine":
		var args struct {
			FilePath string          `json:"filePath"`
			Value    json.RawMessage `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		if err := utils.AppendJsonLine(args.FilePath, args.Value); err != nil {
			return err
		}
		if err := utils.EncodeResponse(nil); err != nil {
			return err
		}
	case "writeFileIfChanged":
		var args struct {
			FilePath string `json:"filePath"`
			Content  string `json:"content"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := utils.WriteFileIfChanged(args.FilePath, args.Content)
		if err != nil {
			return err
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	case "isPathWithin":
		var args struct {
			RootDir   string `json:"rootDir"`
			Candidate string `json:"candidate"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := utils.IsPathWithin(args.RootDir, args.Candidate)
		if err != nil {
			return err
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	case "listFilesRecursive":
		var args struct {
			RootDir string `json:"rootDir"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result, err := utils.ListFilesRecursive(args.RootDir)
		if err != nil {
			return err
		}
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}
	}
	return nil
}
