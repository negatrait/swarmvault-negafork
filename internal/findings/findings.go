package findings

import (
	"strings"
)

// NormalizeFindingSeverity normalizes the finding severity string.
func NormalizeFindingSeverity(value string) string {
	strValue := value

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
