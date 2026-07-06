package cmd

import (
	"encoding/json"
	"os"
	"swarmvault-native/internal/hooks"
	"swarmvault-native/internal/utils"
)

func HandleHooks() error {
	var payload utils.ActionPayload
	if err := utils.DecodePayload(&payload); err != nil {
		return err
	}

	type HooksArgs struct {
		RootDir string                     `json:"vaultRoot"`
		Options hooks.GitHookTargetOptions `json:"options"`
	}

	var cmdArgs HooksArgs
	if err := json.Unmarshal(payload.Args, &cmdArgs); err != nil {
		return err
	}

	var result any
	var err error

	switch payload.Action {
	case "getGitHookStatus":
		result, err = hooks.GetGitHookStatus(cmdArgs.RootDir, cmdArgs.Options)
	case "installGitHooks":
		result, err = hooks.InstallGitHooks(cmdArgs.RootDir, cmdArgs.Options)
	case "uninstallGitHooks":
		result, err = hooks.UninstallGitHooks(cmdArgs.RootDir, cmdArgs.Options)
	default:
		return os.ErrInvalid
	}

	if err != nil {
		return err
	}

	return utils.EncodeResponse(result)
}
