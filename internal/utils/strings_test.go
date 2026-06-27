package utils

import "testing"

func TestNormalizeWhitespace(t *testing.T) {
	if NormalizeWhitespace("  a  b  ") != "a b" {
		t.Error("NormalizeWhitespace failed")
	}

}
