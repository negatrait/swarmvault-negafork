package types_test

import (
	"swarmvault-native/internal/types"
	"testing"
)

func TestHasCapability(t *testing.T) {
	capabilities := []types.ProviderCapability{types.ProviderCapabilityChat, types.ProviderCapabilityVision}
	if !types.HasCapability(capabilities, types.ProviderCapabilityChat) {
		t.Errorf("Expected capability list to have chat capability")
	}
	if types.HasCapability(capabilities, types.ProviderCapabilityAudio) {
		t.Errorf("Expected capability list not to have audio capability")
	}
}
