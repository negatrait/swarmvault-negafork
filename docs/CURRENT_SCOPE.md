# Daily Porting Scope: tokenize

## 1. Goal
Port the stateless utility file `packages/engine/src/tokenize.ts` to Go. This file is a pure leaf node and its entire contents (under 150 lines) will be ported in a single run. The physical audit of the Go codebase revealed NO stubs, TODOs, fakes or mocks. We are cleared to progress according to Scenario A of the migration decision tree.
  - **Metrics:** `internal/parser/tokenize.go` created. The functions `tokenize` and `contentTokens` are fully implemented in Go.
  - **Pitfalls:** Ensure parity with the regex fallback tokenization since compromise NLP is not easily replicated in Go. As indicated by the fallback, `[a-z0-9][a-z0-9-]{1,}` is the regex pattern to be used.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/tokenize.ts`
- **Source Export(s):** `function tokenize(...)`, `function contentTokens(...)`
- **Target File:** `internal/parser/tokenize.go`
- **Target Export:** `func Tokenize(...)`, `func ContentTokens(...)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native parser` (or generic handler in `cmd/swarmvault-native`)
- **TS Delegation Call:** Update `packages/engine/src/tokenize.ts` to route execution for the function through the centralized `runGoSidecarSync` wrapper using specific action payloads (e.g., `action: "tokenize"` and `action: "contentTokens"`).

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries only (`regexp`, `strings`). No external dependencies or stubs are needed.
- **Go-to-Go Native Imports:** None required. This is a pure leaf.
- **Transitive Blocks:** Stubbing is strictly forbidden. The logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This file will easily be under 150 lines.
- **Function Limit:** Max 80 Lines of Code per function.
- **Nesting Limit:** Maximum of 3 levels deep. Use early returns and guard clauses if necessary.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
