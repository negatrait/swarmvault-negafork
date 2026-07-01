package cmd

import (
	"encoding/json"
	"fmt"
	"swarmvault-native/internal/utils"
	"swarmvault-native/internal/websearch"
)

func HandleWebSearch() error {
	var payload struct {
		Action string          `json:"action"`
		Args   json.RawMessage `json:"args"`
	}

	if err := utils.DecodePayload(&payload); err != nil {
		return err
	}

	switch payload.Action {
	case "http-json-search":
		var args struct {
			ID     string          `json:"id"`
			Config json.RawMessage `json:"config"`
			Query  string          `json:"query"`
			Limit  int             `json:"limit"`
		}
		if err := json.Unmarshal(payload.Args, &args); err != nil {
			return err
		}

		adapter := websearch.NewHttpJsonWebSearchAdapter(args.ID, args.Config)
		limit := args.Limit
		if limit == 0 {
			limit = 5
		}

		results, err := adapter.Search(args.Query, limit)
		if err != nil {
			return err
		}
		return utils.EncodeResponse(results)

	default:
		return fmt.Errorf("unknown websearch action: %s", payload.Action)
	}
}
