# Daily Porting Scope: large-repo-defaults

## 1. Goal
Port the stateless utility file `packages/engine/src/large-repo-defaults.ts` to Go. This file is a pure leaf node and its entire contents (around 100 lines) will be ported in a single run. The physical audit of the Go codebase revealed NO stubs, TODOs, fakes or mocks. We are cleared to progress according to Scenario A of the migration decision tree.
  - **Metrics:** `internal/config/large_repo_defaults.go` created. The function `resolveLargeRepoDefaults` is fully implemented in Go.
  - **Pitfalls:** Ensure exact parity with the math/floor calculations for similarity thresholds.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/large-repo-defaults.ts`
- **Source Export(s):** `function resolveLargeRepoDefaults(...)`
- **Target File:** `internal/config/large_repo_defaults.go`
- **Target Export:** `func ResolveLargeRepoDefaults(...)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native config` (or generic handler in `cmd/swarmvault-native`)
- **TS Delegation Call:** Update `packages/engine/src/large-repo-defaults.ts` to route execution for the function through the centralized `runGoSidecarSync` wrapper using specific action payloads (e.g., `action: "resolveLargeRepoDefaults"`).

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries only (`math`). No external dependencies or stubs are needed.
- **Go-to-Go Native Imports:** None required. This is a pure leaf.
- **Transitive Blocks:** Stubbing is strictly forbidden. The logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This file will easily be under 150 lines.
- **Function Limit:** Max 80 Lines of Code per function.
- **Nesting Limit:** Maximum of 3 levels deep. Use early returns and guard clauses if necessary.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
