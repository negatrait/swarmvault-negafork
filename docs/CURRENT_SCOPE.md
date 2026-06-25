# Daily Porting Scope: findings

## 1. Goal
Port the stateless utility file `packages/engine/src/findings.ts` to Go. This file is a pure, zero-dependency leaf node and its entire contents (under 150 lines) will be ported in a single run. The physical audit of the Go codebase revealed NO stubs, TODOs, fakes or mocks. We are cleared to progress according to Scenario A of the migration decision tree.
  - **Metrics:** `internal/findings/findings.go` created. The function `normalizeFindingSeverity` is fully implemented in Go.
  - **Pitfalls:** Maintain exact parity with the TS severity string mappings. Ensure the TS to Go bridge correctly handles the `unknown` type by passing it as a string from TS to the Go CLI.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/findings.ts`
- **Source Export(s):** `function normalizeFindingSeverity(...)`
- **Target File:** `internal/findings/findings.go`
- **Target Export:** `func NormalizeFindingSeverity(...)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native findings` (or generic handler in `cmd/swarmvault-native`)
- **TS Delegation Call:** Update `packages/engine/src/findings.ts` to route execution for the function through the centralized `runGoSidecarSync` wrapper using specific action payloads (e.g., `action: "normalizeFindingSeverity"`).

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries only (`strings`). No external dependencies or stubs are needed.
- **Go-to-Go Native Imports:** None required. This is a pure leaf.
- **Transitive Blocks:** Stubbing is strictly forbidden. The logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This file will easily be under 50 lines.
- **Function Limit:** Max 80 Lines of Code per function.
- **Nesting Limit:** Maximum of 3 levels deep. Use early returns and guard clauses if necessary.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
