# Daily Porting Scope: redaction

## 1. Goal
Port the leaf function `resolveRedactionPatterns` from `packages/engine/src/redaction.ts` to Go. The file is over 150 lines (216 lines), so we are applying the Slicing Decision Tree and scoping exactly one leaf function to prevent timeouts and keep differential testing reliable. The physical audit of the Go codebase revealed NO stubs, TODOs, fakes or mocks. We are cleared to progress according to Scenario A of the migration decision tree.
  - **Metrics:** `internal/redaction/redaction.go` created. The function `ResolveRedactionPatterns` is fully implemented in Go.
  - **Pitfalls:** Ensure regex parsing and validation matches TS behavior (especially error throwing for invalid regex) to guarantee strict 1:1 parity during parsing.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/redaction.ts`
- **Source Export(s):** `resolveRedactionPatterns`
- **Target File:** `internal/redaction/redaction.go`
- **Target Export:** `ResolveRedactionPatterns`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native redaction`
- **TS Delegation Call:** Update `packages/engine/src/redaction.ts` to route execution for `resolveRedactionPatterns` through our centralized `runGoSidecarSync` wrapper using a JSON payload with action `"resolveRedactionPatterns"`.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries only (`fmt`, `regexp`). `swarmvault-native/internal/types` will be used for the configuration structs if needed. No unported dependencies or stubs are needed.
- **Go-to-Go Native Imports:** Standard libraries (e.g. `regexp`). This is a pure leaf utility.
- **Transitive Blocks:** Stubbing is strictly forbidden. The logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This will easily be under the limit in Go.
- **Function Limit:** Max 80 Lines of Code per function. Extract validation helpers if needed.
- **Nesting Limit:** Maximum of 3 levels deep. Use early returns and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
