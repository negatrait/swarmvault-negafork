package websearch

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"
)

func TestDeepGet(t *testing.T) {
	data := map[string]any{
		"a": map[string]any{
			"b": map[string]any{
				"c": "value",
			},
		},
		"x": "flat",
	}

	tests := []struct {
		name     string
		path     string
		expected any
	}{
		{"Nested", "a.b.c", "value"},
		{"Flat", "x", "flat"},
		{"Not Found", "a.b.d", nil},
		{"Empty Path", "", data},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pathPtr := &tt.path
			if tt.path == "" {
				pathPtr = nil
			}
			result := deepGet(data, pathPtr)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("deepGet() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestEnvOrUndefined(t *testing.T) {
	os.Setenv("TEST_API_KEY", "secret-key")
	defer os.Unsetenv("TEST_API_KEY")

	key := "TEST_API_KEY"
	val := envOrUndefined(&key)
	if val == nil || *val != "secret-key" {
		t.Errorf("envOrUndefined() = %v, want secret-key", val)
	}

	badKey := "NON_EXISTENT_KEY"
	if envOrUndefined(&badKey) != nil {
		t.Errorf("envOrUndefined() expected nil")
	}
}

func TestHttpJsonWebSearchAdapter(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		if r.URL.Query().Get("query") != "test" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		response := map[string]any{
			"data": map[string]any{
				"items": []map[string]any{
					{
						"t": "Test Title",
						"u": "https://example.com",
						"s": "Test snippet",
					},
				},
			},
		}

		_ = json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	os.Setenv("TEST_API_KEY", "test-key")
	defer os.Unsetenv("TEST_API_KEY")

	configJSON := `{
		"type": "http-json",
		"endpoint": "` + server.URL + `",
		"method": "GET",
		"apiKeyEnv": "TEST_API_KEY",
		"queryParam": "query",
		"resultsPath": "data.items",
		"titleField": "t",
		"urlField": "u",
		"snippetField": "s"
	}`

	adapter := NewHttpJsonWebSearchAdapter("test-adapter", json.RawMessage(configJSON))

	results, err := adapter.Search("test", 5)
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}

	if results[0].Title != "Test Title" || results[0].URL != "https://example.com" || results[0].Snippet != "Test snippet" {
		t.Errorf("Unexpected result: %+v", results[0])
	}
}
