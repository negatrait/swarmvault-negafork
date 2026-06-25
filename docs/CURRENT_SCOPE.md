# Daily Porting Scope: token-estimation

## 1. Goal
Port the stateless utility functions in `packages/engine/src/token-estimation.ts` to Go. This file is a pure, zero-dependency leaf node and its entire contents (under 150 lines) will be ported in a single run. The physical audit of the Go codebase revealed NO stubs, TODOs, fakes or mocks. We are cleared to progress according to Scenario A of the migration decision tree.
  - **Metrics:** `internal/parser/token_estimation.go` created. All three functions (`estimateTokens`, `estimatePageTokens`, `trimToTokenBudget`) fully implemented in Go.
  - **Pitfalls:** Do not overcomplicate the Go heuristic regex or string splitting logic; maintain exact parity with the TS line prefix and regex checks. Ensure struct fields map 1:1 with TypeScript interfaces (`PageTokenEstimate`, `TokenBudgetResult`).

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/token-estimation.ts`
- **Source Export(s):** `function estimateTokens(...)`, `function estimatePageTokens(...)`, `function trimToTokenBudget(...)`
- **Target File:** `internal/parser/token_estimation.go`
- **Target Export:** `func EstimateTokens(...)`, `func EstimatePageTokens(...)`, `func TrimToTokenBudget(...)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native parser token-estimate` (or generic handler in `cmd/swarmvault-native`)
- **TS Delegation Call:** Update `packages/engine/src/token-estimation.ts` to route execution for all three functions through the centralized `runGoSidecarSync` wrapper using specific action payloads (e.g., `action: "estimateTokens"`).

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries only (`regexp`, `strings`, `math`, `sort`). No external dependencies or stubs are needed.
- **Go-to-Go Native Imports:** None required. This is a pure leaf.
- **Transitive Blocks:** Stubbing is strictly forbidden. The logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This file will easily be under 200 lines.
- **Function Limit:** Max 80 Lines of Code per function.
- **Nesting Limit:** Maximum of 3 levels deep. Use early returns and guard clauses if necessary.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1 (`PageTokenEstimate` and `TokenBudgetResult` JSON parity).
- Trimming logic must prioritize pages identically (descending priority sort) and handle ties similarly to JS standard library `sort`.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
