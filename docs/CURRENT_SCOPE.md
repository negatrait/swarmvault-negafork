# Daily Porting Scope: agents

## 1. Goal
Remove the technical debt and temporary stub `fileExists` in `internal/agents/status.go`. A physical audit revealed that this stub was left behind instead of properly importing and utilizing the fully ported Go utility `utils.FileExists`.
  - **Measurable success:** The `fileExists` function is completely removed from `internal/agents/status.go`.
  - **Identified pitfalls:** Relying on the `os.Stat` stub fails to use the centralized file existence check which may handle permissions/existence logic specifically.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/agents/status.ts`
- **Source Export(s):** N/A (Removing a Go stub)
- **Target File:** `internal/agents/status.go`
- **Target Export:** `func GetAgentInstallStatus(...)` (Will be updated to use the native `utils` package)

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** N/A (Existing bridge contract remains unchanged)
- **TS Delegation Call:** N/A (No updates needed in `packages/engine/src/agents.ts` for this technical debt resolution)

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** `swarmvault-native/internal/utils`
- **Go-to-Go Native Imports:** `internal/agents/status.go` must import `swarmvault-native/internal/utils` natively and call `utils.FileExists(path)`. The TS-to-Go bridge is strictly forbidden for Go-to-Go calls.
- **Transitive Blocks:** The Builder must completely delete the `fileExists` stub. Stubbing is forbidden, and the implementation must be 100% complete using native Go imports.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. Split structs to `types.go` or sub-functions to separate files if approaching this limit.
- **Function Limit:** Max 80 Lines of Code. Helper functions must be extracted if exceeded.
- **Nesting Limit:** Maximum of 3 levels deep. Use early exits and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
