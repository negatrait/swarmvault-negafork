package config

import (
	"math"
)

type ResolvedLargeRepoDefaults struct {
	GodNodeLimit         int     `json:"godNodeLimit"`
	FoldCommunitiesBelow int     `json:"foldCommunitiesBelow"`
	SimilarityEdgeCap    int     `json:"similarityEdgeCap"`
	SimilarityIdfFloor   float64 `json:"similarityIdfFloor"`
}

const (
	LargeRepoNodeThreshold    = 1000
	DefaultSmallGodNodeLimit  = 20
	DefaultLargeGodNodeLimit  = 10
	DefaultSimilarityIdfFloor = 0.5
	SimilarityEdgeCapMax      = 20000
	SimilarityEdgeCapPerNode  = 5
	MinFoldBelow              = 3
)

type GraphConfig struct {
	GodNodeLimit         *int     `json:"godNodeLimit,omitempty"`
	FoldCommunitiesBelow *int     `json:"foldCommunitiesBelow,omitempty"`
	SimilarityEdgeCap    *int     `json:"similarityEdgeCap,omitempty"`
	SimilarityIdfFloor   *float64 `json:"similarityIdfFloor,omitempty"`
}

type VaultConfig struct {
	Graph *GraphConfig `json:"graph,omitempty"`
}

type ResolveLargeRepoDefaultsInput struct {
	NodeCount        float64      `json:"nodeCount"`
	TotalCommunities *float64     `json:"totalCommunities,omitempty"`
	Config           *VaultConfig `json:"config,omitempty"`
}

func clampPositiveInteger(value float64, fallback int) int {
	if math.IsNaN(value) || math.IsInf(value, 0) || value <= 0 {
		return fallback
	}
	return int(math.Max(1, math.Floor(value)))
}

func clampNonNegativeNumber(value float64, fallback float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return fallback
	}
	return value
}

func ResolveLargeRepoDefaults(input ResolveLargeRepoDefaultsInput) ResolvedLargeRepoDefaults {
	nodeCount := math.Max(0, math.Floor(input.NodeCount))

	totalCommunitiesValue := 0.0
	if input.TotalCommunities != nil {
		totalCommunitiesValue = *input.TotalCommunities
	}
	totalCommunities := math.Max(0, math.Floor(totalCommunitiesValue))

	var graphConfig *GraphConfig
	if input.Config != nil {
		graphConfig = input.Config.Graph
	}

	isLargeRepo := nodeCount > LargeRepoNodeThreshold

	defaultGodNodeLimit := DefaultSmallGodNodeLimit
	if isLargeRepo {
		defaultGodNodeLimit = DefaultLargeGodNodeLimit
	}

	godNodeLimit := defaultGodNodeLimit
	if graphConfig != nil && graphConfig.GodNodeLimit != nil {
		godNodeLimit = clampPositiveInteger(float64(*graphConfig.GodNodeLimit), defaultGodNodeLimit)
	}

	defaultSimilarityEdgeCap := int(math.Min(SimilarityEdgeCapMax, math.Max(0, SimilarityEdgeCapPerNode*nodeCount)))
	similarityEdgeCap := defaultSimilarityEdgeCap
	if graphConfig != nil && graphConfig.SimilarityEdgeCap != nil {
		similarityEdgeCap = clampPositiveInteger(float64(*graphConfig.SimilarityEdgeCap), defaultSimilarityEdgeCap)
	}

	similarityIdfFloor := DefaultSimilarityIdfFloor
	if graphConfig != nil && graphConfig.SimilarityIdfFloor != nil {
		similarityIdfFloor = clampNonNegativeNumber(*graphConfig.SimilarityIdfFloor, DefaultSimilarityIdfFloor)
	}

	defaultFoldBelow := int(math.Max(MinFoldBelow, math.Ceil(totalCommunities/50.0)))
	foldCommunitiesBelow := defaultFoldBelow
	if graphConfig != nil && graphConfig.FoldCommunitiesBelow != nil {
		foldCommunitiesBelow = clampPositiveInteger(float64(*graphConfig.FoldCommunitiesBelow), defaultFoldBelow)
	}

	return ResolvedLargeRepoDefaults{
		GodNodeLimit:         godNodeLimit,
		FoldCommunitiesBelow: foldCommunitiesBelow,
		SimilarityEdgeCap:    similarityEdgeCap,
		SimilarityIdfFloor:   similarityIdfFloor,
	}
}
