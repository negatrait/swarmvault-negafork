package freshness

import (
	"math"
	"time"
	"swarmvault-native/internal/types"
)

const (
	DefaultHalfLifeDays float64 = 365
	DefaultStaleThreshold float64 = 0.3
)

var DefaultHalfLifeDaysBySourceClass = map[types.SourceClass]float64{
	"first_party": 365,
	"third_party": 90,
	"resource":    730,
	"generated":   30,
}

type ApplyDecayResult struct {
	Updated     []types.GraphPage `json:"updated"`
	MarkedStale []string          `json:"markedStale"`
}

func ResolveDecayConfig(config *types.DecayConfig) types.DecayConfig {
	if config == nil {
		config = &types.DecayConfig{}
	}

	defaultHalfLifeDays := DefaultHalfLifeDays
	if config.DefaultHalfLifeDays != nil && *config.DefaultHalfLifeDays > 0 {
		defaultHalfLifeDays = *config.DefaultHalfLifeDays
	}

	staleThreshold := DefaultStaleThreshold
	if config.StaleThreshold != nil && *config.StaleThreshold >= 0 && *config.StaleThreshold <= 1 {
		staleThreshold = *config.StaleThreshold
	}

	halfLifeDaysBySourceClass := make(map[types.SourceClass]float64)
	for k, v := range DefaultHalfLifeDaysBySourceClass {
		halfLifeDaysBySourceClass[k] = v
	}
	if config.HalfLifeDaysBySourceClass != nil {
		for k, v := range config.HalfLifeDaysBySourceClass {
			halfLifeDaysBySourceClass[k] = v
		}
	}

	return types.DecayConfig{
		DefaultHalfLifeDays:       &defaultHalfLifeDays,
		StaleThreshold:            &staleThreshold,
		HalfLifeDaysBySourceClass: halfLifeDaysBySourceClass,
	}
}

func ResolveHalfLifeForSourceClass(sourceClass *types.SourceClass, config types.DecayConfig) float64 {
	defaultHalfLife := DefaultHalfLifeDays
	if config.DefaultHalfLifeDays != nil {
		defaultHalfLife = *config.DefaultHalfLifeDays
	}

	if sourceClass == nil {
		return defaultHalfLife
	}

	if config.HalfLifeDaysBySourceClass != nil {
		if override, exists := config.HalfLifeDaysBySourceClass[*sourceClass]; exists && override > 0 {
			return override
		}
	}

	if baseline, exists := DefaultHalfLifeDaysBySourceClass[*sourceClass]; exists && baseline > 0 {
		return baseline
	}

	return defaultHalfLife
}

func ClampScore(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 1
	}
	return math.Max(0, math.Min(1, value))
}

func ComputeDecayScore(lastConfirmedAt *string, sourceClass *types.SourceClass, config types.DecayConfig, now time.Time) float64 {
	if lastConfirmedAt == nil || *lastConfirmedAt == "" {
		return 1
	}

	parsed, err := time.Parse(time.RFC3339Nano, *lastConfirmedAt)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339, *lastConfirmedAt)
		if err != nil {
			return 1
		}
	}

	ageMs := float64(now.UnixMilli() - parsed.UnixMilli())
	if ageMs <= 0 {
		return 1
	}

	ageDays := ageMs / (1000 * 60 * 60 * 24)
	halfLifeDays := ResolveHalfLifeForSourceClass(sourceClass, config)
	if halfLifeDays <= 0 {
		return 1
	}

	score := math.Pow(0.5, ageDays/halfLifeDays)
	return ClampScore(score)
}

func ApplyDecayToPages(pages []types.GraphPage, config types.DecayConfig, now time.Time) ApplyDecayResult {
	staleThreshold := DefaultStaleThreshold
	if config.StaleThreshold != nil {
		staleThreshold = *config.StaleThreshold
	}

	markedStale := make([]string, 0)
	updated := make([]types.GraphPage, len(pages))

	for i, page := range pages {
		decayScore := ComputeDecayScore(page.LastConfirmedAt, page.SourceClass, config, now)
		previousFreshness := page.Freshness
		nextFreshness := previousFreshness

		if page.SupersededBy != nil && *page.SupersededBy != "" {
			nextFreshness = "stale"
		} else if decayScore < staleThreshold {
			nextFreshness = "stale"
		} else {
			nextFreshness = "fresh"
		}

		if nextFreshness == "stale" && previousFreshness != "stale" {
			markedStale = append(markedStale, page.ID)
		}

		updated[i] = page
		updated[i].DecayScore = &decayScore
		updated[i].Freshness = nextFreshness
	}

	return ApplyDecayResult{
		Updated:     updated,
		MarkedStale: markedStale,
	}
}
