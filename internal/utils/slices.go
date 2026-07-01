package utils

import (
	"slices"
)

func UniqueStrings(items []string) []string {
	seen := make(map[string]bool)
	var res []string
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			res = append(res, item)
		}
	}
	return res
}

func Jaccard(left, right []string) float64 {
	if len(left) == 0 && len(right) == 0 {
		return 1
	}
	leftSet := make(map[string]struct{})
	for _, l := range left {
		leftSet[l] = struct{}{}
	}
	rightSet := make(map[string]struct{})
	for _, r := range right {
		rightSet[r] = struct{}{}
	}

	intersection := 0
	for l := range leftSet {
		if _, ok := rightSet[l]; ok {
			intersection++
		}
	}

	union := len(leftSet) + len(rightSet) - intersection
	if union == 0 {
		return 0
	}
	return float64(intersection) / float64(union)
}

func SortStrings(s []string) []string {
	res := slices.Clone(s)
	slices.Sort(res)
	return res
}
