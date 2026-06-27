package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/config"
	"swarmvault-native/internal/utils"
)

type ConfigPayload struct {
	Action string          `json:"action"`
	Args   json.RawMessage `json:"args"`
}

func HandleConfig() error {
	var payload ConfigPayload
	if err := utils.DecodePayload(&payload); err != nil {
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	switch payload.Action {
	case "resolveLargeRepoDefaults":
		var args config.ResolveLargeRepoDefaultsInput
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := config.ResolveLargeRepoDefaults(args)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "classifyRepoPath":
		var args struct {
			RelativePath string               `json:"relativePath"`
			RepoAnalysis *config.RepoAnalysis `json:"repoAnalysis"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := config.ClassifyRepoPath(args.RelativePath, args.RepoAnalysis)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "normalizeExtractClasses":
		var args struct {
			RepoAnalysis *config.RepoAnalysis `json:"repoAnalysis"`
			Extra        []string             `json:"extra"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := config.NormalizeExtractClasses(args.RepoAnalysis, args.Extra)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "aggregateSourceClass":
		var args struct {
			Values []*string `json:"values"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := config.AggregateSourceClass(args.Values)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	case "aggregateManifestSourceClass":
		var args struct {
			Manifests []config.SourceManifest `json:"manifests"`
			SourceIds []string                `json:"sourceIds"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return fmt.Errorf("error decoding args: %w", err)
		}
		result := config.AggregateManifestSourceClass(args.Manifests, args.SourceIds)
		if err := utils.EncodeResponse(result); err != nil {
			return err
		}

	default:
		return fmt.Errorf("unknown config action: %s", payload.Action)
	}

	return nil
}
