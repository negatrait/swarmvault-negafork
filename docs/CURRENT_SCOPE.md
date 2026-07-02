# Daily Porting Scope: internal/utils/strings.go

## 1. Goal
Fix the stubbed/dummy code found in `internal/utils/strings.go` to satisfy the Zero-Stubbing Mandate. The `ExtractJson` function currently has a stub block (`var dummy map[string]any`). This violates the physical-first codebase audit rule.
  - **Metrics:** Re-implement `ExtractJson` fully without using `var dummy` placeholders. The function must robustly parse json and fall back cleanly without shortcuts.
  - **Pitfalls:** The original code attempts to slice standard JSON iteratively to find valid fragments. We must ensure the actual parsing logic aligns properly with TypeScript behaviour.

## 2. Source-to-Target Map
- **Source File:** `internal/utils/strings.go` (Self-contained fix, no specific TS file mapped)
- **Source Export(s):** N/A
- **Target File:** `internal/utils/strings.go`
- **Target Export:** `func ExtractJson(text string) (string, error)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** No new command needed. This is internal utility code that is already exposed via the `utils` subcommand (`HandleUtils` in `internal/cmd/utils.go`).
- **TS Delegation Call:** Existing bridge in `packages/engine/src/utils.ts` should continue to function normally.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** `encoding/json`, `strings`, `errors`, `regexp`.
- **Go-to-Go Native Imports:** None needed, purely internal file.
- **Transitive Blocks:** The builder will fully implement the JSON extraction. No stubs.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This file is currently small.
- **Function Limit:** Max 80 Lines of Code.
- **Nesting Limit:** Maximum of 3 levels deep.

## 6. Parity Expectations
- Input/Output schema must remain unchanged (takes string, returns string/error).
- Will properly unmarshal the slice using `json.RawMessage` or an empty interface `interface{}` to check if it's valid JSON instead of `var dummy map[string]any`.
