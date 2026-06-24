package utils

import (
	"crypto/sha256"
	"encoding/hex"
)

// Sha256 computes the SHA256 hex string of the given value.
func Sha256(value []byte) string {
	hash := sha256.New()
	hash.Write(value)
	return hex.EncodeToString(hash.Sum(nil))
}

// Sha256String is a helper for string inputs.
func Sha256String(value string) string {
	return Sha256([]byte(value))
}
