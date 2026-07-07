package providers_test

import (
	"swarmvault-native/internal/providers"
	"swarmvault-native/internal/types"
	"testing"
)

const (
	constSuccess  = "success"
	constFallback = "fallback"
)

type mockProvider struct {
	capabilities []types.ProviderCapability
}

func (m *mockProvider) GetCapabilities() []types.ProviderCapability {
	return m.capabilities
}

func (m *mockProvider) GetType() types.ProviderType {
	return "mock"
}

func TestLookupPresetCapabilities(t *testing.T) {
	preset := providers.LookupPresetCapabilities("openai")
	if preset == nil {
		t.Fatalf("Expected preset 'openai' to be found")
	}
	if preset.APIStyle != "responses" {
		t.Errorf("Expected APIStyle 'responses', got %s", preset.APIStyle)
	}

	unknown := providers.LookupPresetCapabilities("unknown-preset")
	if unknown != nil {
		t.Fatalf("Expected nil for unknown preset")
	}
}

func TestWithCapabilityFallback(t *testing.T) {
	provider := &mockProvider{
		capabilities: []types.ProviderCapability{types.ProviderCapabilityChat},
	}

	// Test supported capability
	outcome, err := providers.WithCapabilityFallback[string](provider, types.ProviderCapabilityChat, func() (string, error) {
		return constSuccess, nil
	}, func() (string, error) {
		return constFallback, nil
	})

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if !outcome.Supported {
		t.Errorf("Expected supported to be true")
	}
	if outcome.Value == nil || *outcome.Value != constSuccess {
		t.Errorf("Expected value 'success'")
	}

	// Test unsupported capability
	outcome, err = providers.WithCapabilityFallback[string](provider, types.ProviderCapabilityVision, func() (string, error) {
		return constSuccess, nil
	}, func() (string, error) {
		return constFallback, nil
	})

	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if outcome.Supported {
		t.Errorf("Expected supported to be false")
	}
	if outcome.Value == nil || *outcome.Value != constFallback {
		t.Errorf("Expected value 'fallback'")
	}
}
