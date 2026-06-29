package redaction

import (
	"fmt"
	"regexp"
)

const DefaultPlaceholder = "[REDACTED]"

type RedactionPattern struct {
	ID          string `json:"id"`
	Pattern     string `json:"pattern"`
	Flags       string `json:"flags,omitempty"`
	Placeholder string `json:"placeholder,omitempty"`
	Description string `json:"description,omitempty"`
}

type ConfiguredRedactionPattern struct {
	ID          string `json:"id"`
	Pattern     string `json:"pattern"`
	Flags       string `json:"flags,omitempty"`
	Placeholder string `json:"placeholder,omitempty"`
	Description string `json:"description,omitempty"`
}

type RedactionConfig struct {
	Enabled     *bool                        `json:"enabled,omitempty"`
	Placeholder *string                      `json:"placeholder,omitempty"`
	UseDefaults *bool                        `json:"useDefaults,omitempty"`
	Patterns    []ConfiguredRedactionPattern `json:"patterns,omitempty"`
}

type ResolvedRedactionPatterns struct {
	Enabled     bool               `json:"enabled"`
	Placeholder string             `json:"placeholder"`
	Patterns    []RedactionPattern `json:"patterns"`
}

var DefaultRedactionPatterns = []RedactionPattern{
	{
		ID:          "aws_access_key_id",
		Pattern:     `AKIA[0-9A-Z]{16}`,
		Flags:       "g",
		Description: "AWS Access Key ID",
	},
	{
		ID:          "aws_secret_access_key",
		Pattern:     `(aws_secret_access_key["'\s:=]+)[A-Za-z0-9/+=]{40}`,
		Flags:       "gi",
		Description: "AWS Secret Access Key",
	},
	{
		ID:          "stripe_live_key",
		Pattern:     `sk_live_[0-9a-zA-Z]{24,}`,
		Flags:       "g",
		Description: "Stripe live secret key",
	},
	{
		ID:          "github_personal_access_token",
		Pattern:     `ghp_[A-Za-z0-9]{36}`,
		Flags:       "g",
		Description: "GitHub personal access token (classic)",
	},
	{
		ID:          "github_fine_grained_token",
		Pattern:     `github_pat_[A-Za-z0-9_]{82}`,
		Flags:       "g",
		Description: "GitHub fine-grained personal access token",
	},
	{
		ID:          "jwt",
		Pattern:     `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`,
		Flags:       "g",
		Description: "JSON Web Token",
	},
	{
		ID:          "authorization_bearer",
		Pattern:     `(Authorization:\s*Bearer\s+)[A-Za-z0-9._~+/=-]+`,
		Flags:       "gi",
		Description: "Authorization Bearer header token",
	},
	{
		ID:          "openai_api_key",
		Pattern:     `sk-[A-Za-z0-9]{32,}`,
		Flags:       "g",
		Description: "OpenAI-style API key",
	},
	{
		ID:          "private_key_block",
		Pattern:     `-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----`,
		Flags:       "g",
		Description: "PEM private key block",
	},
}

func ResolveRedactionPatterns(config *RedactionConfig) (*ResolvedRedactionPatterns, error) {
	enabled := true
	if config != nil && config.Enabled != nil {
		enabled = *config.Enabled
	}

	placeholder := DefaultPlaceholder
	if config != nil && config.Placeholder != nil {
		placeholder = *config.Placeholder
	}

	useDefaults := true
	if config != nil && config.UseDefaults != nil {
		useDefaults = *config.UseDefaults
	}

	if !enabled {
		return &ResolvedRedactionPatterns{
			Enabled:     false,
			Placeholder: placeholder,
			Patterns:    make([]RedactionPattern, 0),
		}, nil
	}

	patterns := make([]RedactionPattern, 0)
	if useDefaults {
		patterns = append(patterns, DefaultRedactionPatterns...)
	}

	if config != nil && config.Patterns != nil {
		for _, entry := range config.Patterns {
			flags := entry.Flags
			if flags == "" {
				flags = "g"
			}

			// Validate regex to match TS behavior
			if _, err := regexp.Compile(entry.Pattern); err != nil {
				return nil, fmt.Errorf("Invalid redaction pattern `%s`: %v", entry.ID, err)
			}

			patterns = append(patterns, RedactionPattern{
				ID:          entry.ID,
				Pattern:     entry.Pattern,
				Flags:       flags,
				Placeholder: entry.Placeholder,
				Description: entry.Description,
			})
		}
	}

	return &ResolvedRedactionPatterns{
		Enabled:     enabled,
		Placeholder: placeholder,
		Patterns:    patterns,
	}, nil
}
