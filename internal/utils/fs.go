package utils

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

func EnsureDir(dirPath string) error {
	return os.MkdirAll(dirPath, 0755)
}

func FileExists(filePath string) (bool, error) {
	if filePath == "" {
		return false, nil
	}
	_, err := os.Stat(filePath)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	return false, err
}

func ReadJsonFile[T any](filePath string) (*T, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}

	var result T
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("Failed to parse JSON file %s: %v", filePath, err)
	}
	return &result, nil
}

func WriteJsonFile(filePath string, value any) error {
	dir := filepath.Dir(filePath)
	if err := EnsureDir(dir); err != nil {
		return err
	}

	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	tempPath := filepath.Join(dir, fmt.Sprintf(".%s.%d.%s.tmp", filepath.Base(filePath), os.Getpid(), uuid.New().String()))

	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return err
	}

	if err := os.Rename(tempPath, filePath); err != nil {
		os.Remove(tempPath)
		return err
	}
	return nil
}

func AppendJsonLine(filePath string, value any) error {
	dir := filepath.Dir(filePath)
	if err := EnsureDir(dir); err != nil {
		return err
	}

	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	data = append(data, '\n')

	f, err := os.OpenFile(filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	if _, err := f.Write(data); err != nil {
		return err
	}
	return nil
}

func WriteFileIfChanged(filePath string, content string) (bool, error) {
	dir := filepath.Dir(filePath)
	if err := EnsureDir(dir); err != nil {
		return false, err
	}

	exists, err := FileExists(filePath)
	if err != nil {
		return false, err
	}

	if exists {
		existing, err := os.ReadFile(filePath)
		if err != nil {
			return false, err
		}
		if string(existing) == content {
			return false, nil
		}
	}

	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return false, err
	}
	return true, nil
}

func ToPosix(value string) string {
	if filepath.Separator == '/' {
		return value
	}
	return strings.ReplaceAll(value, string(filepath.Separator), "/")
}

func IsPathWithin(rootDir, candidate string) (bool, error) {
	normRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return false, err
	}
	normCandidate, err := filepath.Abs(candidate)
	if err != nil {
		return false, err
	}

	if normCandidate == normRoot {
		return true, nil
	}

	withSep := normRoot
	if !strings.HasSuffix(withSep, string(filepath.Separator)) {
		withSep += string(filepath.Separator)
	}

	return strings.HasPrefix(normCandidate, withSep), nil
}

func ListFilesRecursive(rootDir string) ([]string, error) {
	var files []string

	err := filepath.WalkDir(rootDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			// Skip directories we can't read
			if d != nil && d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if !d.IsDir() {
			files = append(files, path)
		}
		return nil
	})

	if err != nil {
		// TS version returns empty array on error
		return []string{}, nil
	}

	if files == nil {
		return []string{}, nil
	}
	return files, nil
}
