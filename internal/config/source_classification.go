package config

import (
	"github.com/bmatcuk/doublestar/v4"
	"path/filepath"
	"strings"
)

var AllSourceClasses = []string{"first_party", "third_party", "resource", "generated"}

var thirdPartySegments = map[string]bool{
	"node_modules": true,
	"vendor":       true,
	"Pods":         true,
}

var generatedSegments = map[string]bool{
	"dist":        true,
	"build":       true,
	".next":       true,
	"coverage":    true,
	"DerivedData": true,
	"target":      true,
}

type SourceManifest struct {
	SourceId         string  `json:"sourceId"`
	Title            string  `json:"title"`
	OriginType       string  `json:"originType"`
	SourceKind       string  `json:"sourceKind"`
	SourceType       *string `json:"sourceType,omitempty"`
	SourceClass      *string `json:"sourceClass,omitempty"`
	Language         *string `json:"language,omitempty"`
	OriginalPath     *string `json:"originalPath,omitempty"`
	RepoRelativePath *string `json:"repoRelativePath,omitempty"`
	Url              *string `json:"url,omitempty"`
}

type ClassifyGlobs struct {
	FirstParty []string `json:"first_party,omitempty"`
	ThirdParty []string `json:"third_party,omitempty"`
	Resource   []string `json:"resource,omitempty"`
	Generated  []string `json:"generated,omitempty"`
}

type RepoAnalysis struct {
	ClassifyGlobs  *ClassifyGlobs `json:"classifyGlobs,omitempty"`
	ExtractClasses []string       `json:"extractClasses,omitempty"`
}

func matchesAnyGlob(relativePath string, patterns []string) bool {
	for _, pattern := range patterns {
		if matched, _ := doublestar.Match(pattern, relativePath); matched {
			return true
		}
		if matched, _ := doublestar.Match(pattern, filepath.Base(relativePath)); matched {
			return true
		}
	}
	return false
}

func ClassifyRepoPath(relativePath string, repoAnalysis *RepoAnalysis) string {
	normalized := strings.ReplaceAll(relativePath, "\\", "/")

	if repoAnalysis != nil && repoAnalysis.ClassifyGlobs != nil {
		custom := repoAnalysis.ClassifyGlobs
		if len(custom.FirstParty) > 0 && matchesAnyGlob(normalized, custom.FirstParty) {
			return "first_party"
		}
		if len(custom.ThirdParty) > 0 && matchesAnyGlob(normalized, custom.ThirdParty) {
			return "third_party"
		}
		if len(custom.Resource) > 0 && matchesAnyGlob(normalized, custom.Resource) {
			return "resource"
		}
		if len(custom.Generated) > 0 && matchesAnyGlob(normalized, custom.Generated) {
			return "generated"
		}
	}

	segments := strings.Split(normalized, "/")
	for _, segment := range segments {
		if segment == "" {
			continue
		}
		if thirdPartySegments[segment] {
			return "third_party"
		}
		if generatedSegments[segment] {
			return "generated"
		}
		if strings.HasSuffix(segment, ".xcassets") || strings.HasSuffix(segment, ".imageset") {
			return "resource"
		}
	}

	return "first_party"
}

func NormalizeExtractClasses(repoAnalysis *RepoAnalysis, extra []string) []string {
	configured := []string{"first_party"}
	if repoAnalysis != nil && len(repoAnalysis.ExtractClasses) > 0 {
		configured = repoAnalysis.ExtractClasses
	}

	allowedSet := make(map[string]bool)
	for _, c := range configured {
		allowedSet[c] = true
	}
	for _, e := range extra {
		allowedSet[e] = true
	}

	var result []string
	for _, sc := range AllSourceClasses {
		if allowedSet[sc] {
			result = append(result, sc)
		}
	}
	if result == nil {
		result = make([]string, 0)
	}
	return result
}

func AggregateSourceClass(values []*string) *string {
	availableSet := make(map[string]bool)
	for _, v := range values {
		if v != nil {
			availableSet[*v] = true
		}
	}

	var available []string
	for _, sc := range AllSourceClasses {
		if availableSet[sc] {
			available = append(available, sc)
		}
	}

	if len(available) == 0 {
		return nil
	}

	for _, a := range available {
		if a == "first_party" {
			res := "first_party"
			return &res
		}
	}
	for _, a := range available {
		if a == "resource" {
			res := "resource"
			return &res
		}
	}
	for _, a := range available {
		if a == "third_party" {
			res := "third_party"
			return &res
		}
	}

	res := "generated"
	return &res
}

func AggregateManifestSourceClass(manifests []SourceManifest, sourceIds []string) *string {
	byId := make(map[string]*string)
	for _, m := range manifests {
		byId[m.SourceId] = m.SourceClass
	}

	var values []*string
	for _, sid := range sourceIds {
		values = append(values, byId[sid])
	}
	if values == nil {
		values = make([]*string, 0)
	}

	return AggregateSourceClass(values)
}
