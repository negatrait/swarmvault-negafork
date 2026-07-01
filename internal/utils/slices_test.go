package utils

import "testing"

func TestUniqueStrings(t *testing.T) {
	if len(UniqueStrings([]string{"a", "a", "b"})) != 2 {
		t.Error("UniqueStrings failed")
	}
}

func TestJaccard(t *testing.T) {
	if Jaccard([]string{"a", "b"}, []string{"b", "c"}) != (1.0 / 3.0) {
		t.Error("Jaccard failed")
	}
}
