package types

type ProviderCapability string

const (
	ProviderCapabilityResponses       ProviderCapability = "responses"
	ProviderCapabilityChat            ProviderCapability = "chat"
	ProviderCapabilityStructured      ProviderCapability = "structured"
	ProviderCapabilityTools           ProviderCapability = "tools"
	ProviderCapabilityVision          ProviderCapability = "vision"
	ProviderCapabilityEmbeddings      ProviderCapability = "embeddings"
	ProviderCapabilityStreaming       ProviderCapability = "streaming"
	ProviderCapabilityLocal           ProviderCapability = "local"
	ProviderCapabilityImageGeneration ProviderCapability = "image_generation"
	ProviderCapabilityAudio           ProviderCapability = "audio"
	ProviderCapabilityRerank          ProviderCapability = "rerank"
)

type ProviderType string

type ProviderAdapter interface {
	GetCapabilities() []ProviderCapability
	GetType() ProviderType
}

type DegradeReason string

const (
	DegradeReasonUnsupported DegradeReason = "unsupported"
	DegradeReasonUnknown     DegradeReason = "unknown"
)

type DegradationOutcome[T any] struct {
	Supported bool           `json:"supported"`
	Reason    *DegradeReason `json:"reason,omitempty"`
	Value     *T             `json:"value,omitempty"`
}

func HasCapability(capabilities []ProviderCapability, cap ProviderCapability) bool {
	for _, c := range capabilities {
		if c == cap {
			return true
		}
	}
	return false
}
