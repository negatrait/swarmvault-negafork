package findings

import (
	"strings"
)

// NormalizeFindingSeverity normalizes the finding severity string.
func NormalizeFindingSeverity(value any) string {
	strValue, ok := value.(string)
	if !ok {
		return "info"
	}

	normalized := strings.ToLower(strings.TrimSpace(strValue))

	switch normalized {
	case "error", "critical", "fatal", "high", "severe":
		return "error"
	case "warning", "warn", "medium", "moderate", "caution":
		return "warning"
	default:
		return "info"
	}
}
