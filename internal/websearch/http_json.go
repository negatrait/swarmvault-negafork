package websearch

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"swarmvault-native/internal/types"
)

func deepGet(value any, pathValue *string) any {
	if pathValue == nil || *pathValue == "" {
		return value
	}

	segments := strings.Split(*pathValue, ".")
	var current = value

	for _, segment := range segments {
		if segment == "" {
			continue
		}
		if current == nil {
			return nil
		}

		if m, ok := current.(map[string]any); ok {
			if val, exists := m[segment]; exists {
				current = val
			} else {
				return nil
			}
		} else {
			return nil
		}
	}

	return current
}

func envOrUndefined(name *string) *string {
	if name != nil && *name != "" {
		if val, exists := os.LookupEnv(*name); exists {
			return &val
		}
	}
	return nil
}

type HttpJsonWebSearchAdapter struct {
	Type   string
	ID     string
	Config types.WebSearchProviderConfig
}

func NewHttpJsonWebSearchAdapter(id string, config json.RawMessage) *HttpJsonWebSearchAdapter {
	var c types.WebSearchProviderConfig
	_ = json.Unmarshal(config, &c)
	return &HttpJsonWebSearchAdapter{
		Type:   "http-json",
		ID:     id,
		Config: c,
	}
}

func (a *HttpJsonWebSearchAdapter) Search(query string, limit int) ([]types.WebSearchResult, error) {
	if a.Config.Endpoint == nil || *a.Config.Endpoint == "" {
		return nil, fmt.Errorf("Web search provider %s is missing an endpoint.", a.ID)
	}

	req, err := a.buildRequest(query, limit)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Web search provider %s failed: %d %s", a.ID, resp.StatusCode, resp.Status)
	}

	return a.parseResponse(resp.Body)
}

func (a *HttpJsonWebSearchAdapter) buildRequest(query string, limit int) (*http.Request, error) {
	method := "GET"
	if a.Config.Method != nil && *a.Config.Method != "" {
		method = *a.Config.Method
	}

	headers := a.buildHeaders()
	endpointUrl, err := url.Parse(*a.Config.Endpoint)
	if err != nil {
		return nil, err
	}

	reqBody := a.buildBodyAndQuery(method, query, limit, headers, endpointUrl)

	req, err := http.NewRequest(method, endpointUrl.String(), reqBody)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	return req, nil
}

func (a *HttpJsonWebSearchAdapter) buildHeaders() map[string]string {
	headers := make(map[string]string)
	headers["accept"] = "application/json"
	for k, v := range a.Config.Headers {
		headers[k] = v
	}

	apiKey := envOrUndefined(a.Config.APIKeyEnv)
	if apiKey != nil {
		authHeader := "Authorization"
		if a.Config.APIKeyHeader != nil && *a.Config.APIKeyHeader != "" {
			authHeader = *a.Config.APIKeyHeader
		}
		prefix := "Bearer "
		if a.Config.APIKeyPrefix != nil {
			prefix = *a.Config.APIKeyPrefix
		}
		headers[authHeader] = prefix + *apiKey
	}
	return headers
}

func (a *HttpJsonWebSearchAdapter) buildBodyAndQuery(method, query string, limit int, headers map[string]string, endpointUrl *url.URL) io.Reader {
	queryParam := "q"
	if a.Config.QueryParam != nil && *a.Config.QueryParam != "" {
		queryParam = *a.Config.QueryParam
	}

	limitParam := "limit"
	if a.Config.LimitParam != nil && *a.Config.LimitParam != "" {
		limitParam = *a.Config.LimitParam
	}

	var reqBody io.Reader
	if method == "GET" {
		q := endpointUrl.Query()
		q.Set(queryParam, query)
		q.Set(limitParam, strconv.Itoa(limit))
		endpointUrl.RawQuery = q.Encode()
	} else {
		headers["content-type"] = "application/json"
		bodyMap := map[string]any{
			queryParam: query,
			limitParam: limit,
		}
		bodyBytes, _ := json.Marshal(bodyMap)
		reqBody = bytes.NewBuffer(bodyBytes)
	}
	return reqBody
}

func (a *HttpJsonWebSearchAdapter) parseResponse(body io.Reader) ([]types.WebSearchResult, error) {
	var payload any
	if err := json.NewDecoder(body).Decode(&payload); err != nil {
		return nil, err
	}

	resultsPath := "results"
	if a.Config.ResultsPath != nil {
		resultsPath = *a.Config.ResultsPath
	}
	rawResults := deepGet(payload, &resultsPath)

	resultsArray, ok := rawResults.([]any)
	if !ok {
		return make([]types.WebSearchResult, 0), nil
	}

	var results []types.WebSearchResult
	for _, item := range resultsArray {
		result, ok := a.parseResultItem(item)
		if ok {
			results = append(results, result)
		}
	}

	if results == nil {
		results = make([]types.WebSearchResult, 0)
	}
	return results, nil
}

func (a *HttpJsonWebSearchAdapter) parseResultItem(item any) (types.WebSearchResult, bool) {
	titleField := "title"
	if a.Config.TitleField != nil {
		titleField = *a.Config.TitleField
	}
	titleAny := deepGet(item, &titleField)
	title, ok := titleAny.(string)
	if !ok {
		return types.WebSearchResult{}, false
	}

	urlField := "url"
	if a.Config.URLField != nil {
		urlField = *a.Config.URLField
	}
	urlAny := deepGet(item, &urlField)
	urlStr, ok := urlAny.(string)
	if !ok {
		return types.WebSearchResult{}, false
	}

	snippetField := "snippet"
	if a.Config.SnippetField != nil {
		snippetField = *a.Config.SnippetField
	}
	snippetAny := deepGet(item, &snippetField)
	snippet, _ := snippetAny.(string)

	return types.WebSearchResult{
		Title:   title,
		URL:     urlStr,
		Snippet: snippet,
	}, true
}
