package providers

import (
	"swarmvault-native/internal/types"
)

type ProviderPresetCapability struct {
	PresetID     string                     `json:"presetId"`
	APIStyle     string                     `json:"apiStyle"`
	Capabilities []types.ProviderCapability `json:"capabilities"`
	Notes        string                     `json:"notes"`
}

var CapabilityMatrix = map[string]ProviderPresetCapability{
	"openai": {
		PresetID: "openai",
		APIStyle: "responses",
		Capabilities: []types.ProviderCapability{
			types.ProviderCapabilityResponses, types.ProviderCapabilityChat, types.ProviderCapabilityStructured, types.ProviderCapabilityTools, types.ProviderCapabilityVision, types.ProviderCapabilityEmbeddings, types.ProviderCapabilityStreaming, types.ProviderCapabilityImageGeneration, types.ProviderCapabilityAudio,
		},
		Notes: "Reference implementation. Supports responses API, strict structured output, tool calling, vision, image generation, and Whisper transcription.",
	},
	"openai-compatible": {
		PresetID: "openai-compatible",
		APIStyle: "responses",
		Capabilities: []types.ProviderCapability{
			types.ProviderCapabilityChat, types.ProviderCapabilityStructured, types.ProviderCapabilityEmbeddings, types.ProviderCapabilityAudio,
		},
		Notes: "Generic fallback for self-hosted backends. Structured output adherence varies; verify capability flags per deployment.",
	},
	"openrouter": {
		PresetID: "openrouter",
		APIStyle: "chat",
		Capabilities: []types.ProviderCapability{
			types.ProviderCapabilityChat, types.ProviderCapabilityStructured, types.ProviderCapabilityEmbeddings,
		},
		Notes: "Router of upstream models. No responses API, no vision at the gateway level, structured output requires model-specific care.",
	},
	"groq": {
		PresetID: "groq",
		APIStyle: "chat",
		Capabilities: []types.ProviderCapability{
			types.ProviderCapabilityChat, types.ProviderCapabilityStructured, types.ProviderCapabilityEmbeddings, types.ProviderCapabilityAudio,
		},
		Notes: "Fast chat completions, Whisper-compatible audio endpoint, no vision, no responses API.",
	},
	"together": {
		PresetID: "together",
		APIStyle: "chat",
		Capabilities: []types.ProviderCapability{
			types.ProviderCapabilityChat, types.ProviderCapabilityStructured, types.ProviderCapabilityEmbeddings,
		},
		Notes: "Chat completions with mixed structured-output reliability across hosted models. No vision or audio.",
	},
	"xai": {
		PresetID: "xai",
		APIStyle: "chat",
		Capabilities: []types.ProviderCapability{
			types.ProviderCapabilityChat, types.ProviderCapabilityStructured, types.ProviderCapabilityEmbeddings,
		},
		Notes: "Grok API. Chat and structured output; no vision or audio in the open surface.",
	},
	"cerebras": {
		PresetID: "cerebras",
		APIStyle: "chat",
		Capabilities: []types.ProviderCapability{
			types.ProviderCapabilityChat, types.ProviderCapabilityStructured, types.ProviderCapabilityEmbeddings,
		},
		Notes: "High-throughput inference. No vision, no audio, no image generation.",
	},
	"ollama": {
		PresetID: "ollama",
		APIStyle: "chat",
		Capabilities: []types.ProviderCapability{
			types.ProviderCapabilityChat, types.ProviderCapabilityStructured, types.ProviderCapabilityTools, types.ProviderCapabilityVision, types.ProviderCapabilityEmbeddings, types.ProviderCapabilityStreaming, types.ProviderCapabilityLocal, types.ProviderCapabilityAudio,
		},
		Notes: "Local-first. Capabilities depend on which models are installed; structured output is best-effort.",
	},
}

func LookupPresetCapabilities(presetID string) *ProviderPresetCapability {
	if preset, ok := CapabilityMatrix[presetID]; ok {
		return &preset
	}
	return nil
}

func WithCapabilityFallback[T any](provider types.ProviderAdapter, capability types.ProviderCapability, run func() (T, error), fallback func() (T, error)) (types.DegradationOutcome[T], error) {
	if types.HasCapability(provider.GetCapabilities(), capability) {
		val, err := run()
		if err != nil {
			return types.DegradationOutcome[T]{}, err
		}
		return types.DegradationOutcome[T]{
			Supported: true,
			Reason:    nil,
			Value:     &val,
		}, nil
	}

	fallbackVal, err := fallback()
	if err != nil {
		return types.DegradationOutcome[T]{}, err
	}

	reason := types.DegradeReasonUnsupported
	return types.DegradationOutcome[T]{
		Supported: false,
		Reason:    &reason,
		Value:     &fallbackVal,
	}, nil
}
