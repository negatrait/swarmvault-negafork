package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"swarmvault-native/internal/utils"
)

func HandleUtils() {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}
	if err := utils.DecodePayload(&payload); err != nil {
		fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
		os.Exit(1)
	}

	switch payload.Action {
	case "slugify", "sha256", "toPosix", "firstSentences":
		handleUtilsStringOpsBasic(payload.Action, payload.Args)
	case "extractJson", "normalizeWhitespace", "safeFrontmatter", "truncate":
		handleUtilsStringOpsAdvanced(payload.Action, payload.Args)
	case "ensureDir", "fileExists", "readJsonFile", "writeJsonFile":
		handleUtilsFsOpsBasic(payload.Action, payload.Args)
	case "appendJsonLine", "writeFileIfChanged", "isPathWithin", "listFilesRecursive":
		handleUtilsFsOpsAdvanced(payload.Action, payload.Args)
	default:
		fmt.Fprintf(os.Stderr, "Unknown utils action: %s\n", payload.Action)
		os.Exit(1)
	}
}

func handleUtilsStringOpsBasic(action string, rawArgs json.RawMessage) {
	switch action {
	case "slugify":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(utils.Slugify(args.Value)); err != nil {
			os.Exit(1)
		}
	case "sha256":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(utils.Sha256String(args.Value)); err != nil {
			os.Exit(1)
		}
	case "toPosix":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(utils.ToPosix(args.Value)); err != nil {
			os.Exit(1)
		}
	case "firstSentences":
		var args struct {
			Value string `json:"value"`
			Count int    `json:"count"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(utils.FirstSentences(args.Value, args.Count)); err != nil {
			os.Exit(1)
		}
	}
}

func handleUtilsStringOpsAdvanced(action string, rawArgs json.RawMessage) {
	switch action {
	case "extractJson":
		var args struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.ExtractJson(args.Text)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}
	case "normalizeWhitespace":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(utils.NormalizeWhitespace(args.Value)); err != nil {
			os.Exit(1)
		}
	case "safeFrontmatter":
		var args struct {
			Value map[string]interface{} `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(utils.SafeFrontmatter(args.Value)); err != nil {
			os.Exit(1)
		}
	case "truncate":
		var args struct {
			Value     string `json:"value"`
			MaxLength int    `json:"maxLength"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(utils.Truncate(args.Value, args.MaxLength)); err != nil {
			os.Exit(1)
		}
	}
}

func handleUtilsFsOpsBasic(action string, rawArgs json.RawMessage) {
	switch action {
	case "ensureDir":
		var args struct {
			DirPath string `json:"dirPath"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EnsureDir(args.DirPath); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(nil); err != nil {
			os.Exit(1)
		}
	case "fileExists":
		var args struct {
			FilePath string `json:"filePath"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.FileExists(args.FilePath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}
	case "readJsonFile":
		var args struct {
			FilePath string `json:"filePath"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.ReadJsonFile[interface{}](args.FilePath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}
	case "writeJsonFile":
		var args struct {
			FilePath string      `json:"filePath"`
			Value    interface{} `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.WriteJsonFile(args.FilePath, args.Value); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(nil); err != nil {
			os.Exit(1)
		}
	}
}

func handleUtilsFsOpsAdvanced(action string, rawArgs json.RawMessage) {
	switch action {
	case "appendJsonLine":
		var args struct {
			FilePath string      `json:"filePath"`
			Value    interface{} `json:"value"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.AppendJsonLine(args.FilePath, args.Value); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(nil); err != nil {
			os.Exit(1)
		}
	case "writeFileIfChanged":
		var args struct {
			FilePath string `json:"filePath"`
			Content  string `json:"content"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.WriteFileIfChanged(args.FilePath, args.Content)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}
	case "isPathWithin":
		var args struct {
			RootDir   string `json:"rootDir"`
			Candidate string `json:"candidate"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.IsPathWithin(args.RootDir, args.Candidate)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}
	case "listFilesRecursive":
		var args struct {
			RootDir string `json:"rootDir"`
		}
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.ListFilesRecursive(args.RootDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EncodeResponse(result); err != nil {
			os.Exit(1)
		}
	}
}
