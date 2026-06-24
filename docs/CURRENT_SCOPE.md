# Daily Porting Scope: agents

## 1. Goal
Remove the temporary `fileExists` stub in `internal/agents/status.go`. The TS module `src/utils.ts` and its Go equivalent `internal/utils/fs.go` have been ported and the `utils` command bridged. We must replace the local stub with a native Go-to-Go call to `utils.FileExists`.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/agents/status.ts` (implied origin of logic)
- **Source Export(s):** N/A (Removing stub)
- **Target File:** `internal/agents/status.go`
- **Target Export:** `func GetAgentInstallStatus(...)` (updated to use native utils)

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** N/A (Existing bridge unchanged)
- **TS Delegation Call:** N/A (Existing bridge unchanged)

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** `swarmvault-native/internal/utils`
- **Go-to-Go Native Imports:** `internal/agents/status.go` must import `swarmvault-native/internal/utils` and call `utils.FileExists(path)` natively. It must not use the subprocess bridge.
- **Transitive Blocks:** The Builder must completely remove the `fileExists` stub function from `internal/agents/status.go`. Stubbing is forbidden. Core logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Code. Split structs to `types.go` or sub-functions to separate files if approaching this limit.
- **Function Limit:** Max 80 Lines of Code. Helper functions must be extracted if exceeded.
- **Nesting Limit:** Maximum of 3 levels deep. Use early exits and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.