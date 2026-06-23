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
	case "slugify":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := utils.Slugify(args.Value)
		utils.EncodeResponse(result)

	case "sha256":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := utils.Sha256String(args.Value)
		utils.EncodeResponse(result)

	case "ensureDir":
		var args struct {
			DirPath string `json:"dirPath"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.EnsureDir(args.DirPath); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		utils.EncodeResponse(nil)

	case "fileExists":
		var args struct {
			FilePath string `json:"filePath"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.FileExists(args.FilePath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		utils.EncodeResponse(result)

	case "readJsonFile":
		var args struct {
			FilePath string `json:"filePath"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.ReadJsonFile[interface{}](args.FilePath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		utils.EncodeResponse(result)

	case "writeJsonFile":
		var args struct {
			FilePath string      `json:"filePath"`
			Value    interface{} `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.WriteJsonFile(args.FilePath, args.Value); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		utils.EncodeResponse(nil)

	case "appendJsonLine":
		var args struct {
			FilePath string      `json:"filePath"`
			Value    interface{} `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		if err := utils.AppendJsonLine(args.FilePath, args.Value); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		utils.EncodeResponse(nil)

	case "writeFileIfChanged":
		var args struct {
			FilePath string `json:"filePath"`
			Content  string `json:"content"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.WriteFileIfChanged(args.FilePath, args.Content)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		utils.EncodeResponse(result)

	case "toPosix":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := utils.ToPosix(args.Value)
		utils.EncodeResponse(result)

	case "isPathWithin":
		var args struct {
			RootDir   string `json:"rootDir"`
			Candidate string `json:"candidate"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.IsPathWithin(args.RootDir, args.Candidate)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		utils.EncodeResponse(result)

	case "firstSentences":
		var args struct {
			Value string `json:"value"`
			Count int    `json:"count"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := utils.FirstSentences(args.Value, args.Count)
		utils.EncodeResponse(result)

	case "extractJson":
		var args struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.ExtractJson(args.Text)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		utils.EncodeResponse(result)

	case "normalizeWhitespace":
		var args struct {
			Value string `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := utils.NormalizeWhitespace(args.Value)
		utils.EncodeResponse(result)

	case "safeFrontmatter":
		var args struct {
			Value map[string]interface{} `json:"value"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := utils.SafeFrontmatter(args.Value)
		utils.EncodeResponse(result)

	case "truncate":
		var args struct {
			Value     string `json:"value"`
			MaxLength int    `json:"maxLength"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result := utils.Truncate(args.Value, args.MaxLength)
		utils.EncodeResponse(result)

	case "listFilesRecursive":
		var args struct {
			RootDir string `json:"rootDir"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding args: %v\n", err)
			os.Exit(1)
		}
		result, err := utils.ListFilesRecursive(args.RootDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		utils.EncodeResponse(result)

	default:
		fmt.Fprintf(os.Stderr, "Unknown utils action: %s\n", payload.Action)
		os.Exit(1)
	}
}
