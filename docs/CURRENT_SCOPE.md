# Daily Porting Scope: web-search/http-json

## 1. Goal
Port the stateless leaf module `HttpJsonWebSearchAdapter` from `packages/engine/src/web-search/http-json.ts` to Go under `internal/websearch/http_json.go`. The source file is 95 lines, which falls under the 150-line threshold. Based on the Slicing Decision Tree, we will scope the **entire file** for porting in a single run.
  - **Metrics:** `internal/websearch/http_json.go` created. The Go struct `HttpJsonWebSearchAdapter` and its `Search` method are 100% fully implemented.
  - **Pitfalls:** We must handle generic JSON path extraction (`deepGet`) robustly in Go using map types (`map[string]any`) or a reliable jsonpath library to ensure it handles arbitrary user-configured API responses correctly.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/web-search/http-json.ts`
- **Source Export(s):** `HttpJsonWebSearchAdapter` class (specifically the `search` method).
- **Target File:** `internal/websearch/http_json.go`
- **Target Export:** `HttpJsonWebSearchAdapter` struct and `Search` method.

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native websearch`
- **TS Delegation Call:** Update `packages/engine/src/web-search/http-json.ts` to route execution for `search` through our centralized `runGoSidecar` wrapper (async) from `src/subprocess.ts` using the "websearch" subcommand and "http-json-search" action.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries only (`net/http`, `encoding/json`, `net/url`). We will also use `swarmvault-native/internal/types` for config and result structures (note: currently `types.go` has graph structs, but we'll add `WebSearchResult` there, or define it locally). No unported dependencies or stubs are needed.
- **Go-to-Go Native Imports:** `swarmvault-native/internal/types` if needed for shared types. This is a pure leaf module.
- **Transitive Blocks:** Stubbing is strictly forbidden. The logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This module will easily fit.
- **Function Limit:** Max 80 Lines of Code. Helper functions for `deepGet` must be extracted if the function gets too large.
- **Nesting Limit:** Maximum of 3 levels deep. Use early returns for nil or error states.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1. The search method returns a slice of `WebSearchResult`.
- Unit tests must confirm equivalent behavior for fetching and parsing arbitrary JSON structures using the provided config mappings.
