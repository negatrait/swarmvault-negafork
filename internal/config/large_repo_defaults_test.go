package config

import (
	"testing"
)

func TestResolveLargeRepoDefaults(t *testing.T) {
	t.Run("returns godNodeLimit 20 for small repos", func(t *testing.T) {
		defaults := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{NodeCount: 100})
		if defaults.GodNodeLimit != 20 {
			t.Errorf("Expected 20, got %d", defaults.GodNodeLimit)
		}
	})

	t.Run("returns godNodeLimit 10 for large repos", func(t *testing.T) {
		defaults := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{NodeCount: 5000})
		if defaults.GodNodeLimit != 10 {
			t.Errorf("Expected 10, got %d", defaults.GodNodeLimit)
		}
	})

	t.Run("returns user-configured godNodeLimit regardless of nodeCount", func(t *testing.T) {
		godNodeLimitVal := 7

		userSmall := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{
			NodeCount: 100,
			Config: &VaultConfig{
				Graph: &GraphConfig{
					GodNodeLimit: &godNodeLimitVal,
				},
			},
		})
		if userSmall.GodNodeLimit != 7 {
			t.Errorf("Expected 7, got %d", userSmall.GodNodeLimit)
		}

		userLarge := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{
			NodeCount: 5000,
			Config: &VaultConfig{
				Graph: &GraphConfig{
					GodNodeLimit: &godNodeLimitVal,
				},
			},
		})
		if userLarge.GodNodeLimit != 7 {
			t.Errorf("Expected 7, got %d", userLarge.GodNodeLimit)
		}
	})

	t.Run("grows similarity edge cap linearly up to 20000", func(t *testing.T) {
		d1 := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{NodeCount: 10})
		if d1.SimilarityEdgeCap != 50 {
			t.Errorf("Expected 50, got %d", d1.SimilarityEdgeCap)
		}

		d2 := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{NodeCount: 1000})
		if d2.SimilarityEdgeCap != 5000 {
			t.Errorf("Expected 5000, got %d", d2.SimilarityEdgeCap)
		}

		d3 := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{NodeCount: 4000})
		if d3.SimilarityEdgeCap != 20000 {
			t.Errorf("Expected 20000, got %d", d3.SimilarityEdgeCap)
		}

		d4 := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{NodeCount: 100000})
		if d4.SimilarityEdgeCap != 20000 {
			t.Errorf("Expected 20000, got %d", d4.SimilarityEdgeCap)
		}
	})

	t.Run("derives foldCommunitiesBelow as max(3, ceil(totalCommunities / 50))", func(t *testing.T) {
		totalCommunities1 := 10.0
		d1 := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{
			NodeCount:        100,
			TotalCommunities: &totalCommunities1,
		})
		if d1.FoldCommunitiesBelow != 3 {
			t.Errorf("Expected 3, got %d", d1.FoldCommunitiesBelow)
		}

		totalCommunities2 := 300.0
		d2 := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{
			NodeCount:        5000,
			TotalCommunities: &totalCommunities2,
		})
		if d2.FoldCommunitiesBelow != 6 {
			t.Errorf("Expected 6, got %d", d2.FoldCommunitiesBelow)
		}
	})

	t.Run("respects user-configured similarityIdfFloor and foldCommunitiesBelow", func(t *testing.T) {
		totalCommunities := 300.0
		similarityIdfFloorVal := 1.5
		foldCommunitiesBelowVal := 42

		resolved := ResolveLargeRepoDefaults(ResolveLargeRepoDefaultsInput{
			NodeCount:        100,
			TotalCommunities: &totalCommunities,
			Config: &VaultConfig{
				Graph: &GraphConfig{
					SimilarityIdfFloor:   &similarityIdfFloorVal,
					FoldCommunitiesBelow: &foldCommunitiesBelowVal,
				},
			},
		})

		if resolved.SimilarityIdfFloor != 1.5 {
			t.Errorf("Expected 1.5, got %f", resolved.SimilarityIdfFloor)
		}
		if resolved.FoldCommunitiesBelow != 42 {
			t.Errorf("Expected 42, got %d", resolved.FoldCommunitiesBelow)
		}
	})
}
