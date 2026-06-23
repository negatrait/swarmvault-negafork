package confidence

import (
	"math"
	"strings"
	"swarmvault-native/internal/types"
)

func NodeConfidence(sourceCount int) float64 {
	return math.Min(0.5+float64(sourceCount)*0.15, 0.95)
}

func EdgeConfidence(claims []types.SourceClaim, conceptName string) float64 {
	lower := strings.ToLower(conceptName)
	var relevant []types.SourceClaim
	for _, c := range claims {
		if strings.Contains(strings.ToLower(c.Text), lower) {
			relevant = append(relevant, c)
		}
	}
	if len(relevant) == 0 {
		return 0.5
	}
	sum := 0.0
	for _, c := range relevant {
		sum += c.Confidence
	}
	return sum / float64(len(relevant))
}

func ConflictConfidence(claimA types.SourceClaim, claimB types.SourceClaim) float64 {
	return math.Min(claimA.Confidence, claimB.Confidence)
}
