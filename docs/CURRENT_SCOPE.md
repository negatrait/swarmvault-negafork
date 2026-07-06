# Daily Porting Scope: Hooks (getGitHookStatus)

## 1. Goal
Port the `getGitHookStatus` leaf function from `packages/engine/src/hooks.ts` to Go. This file manages installing and updating git `post-commit` and `post-checkout` hooks to trigger SwarmVault's watcher. Because the TS file is over 150 lines (177 lines), we must adhere to the Slicing Decision Tree and scope exactly one leaf function at a time.
  - Success metric: the `internal/hooks` Go package compiles cleanly, exposes equivalent functionality, and accurately reads git hooks matching TS logic.
  - Identified pitfalls: The logic relies on resolving the nearest git root and checking hook file contents. Path manipulation and file reading must perfectly match Node.js `path` and `fs` behaviors.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/hooks.ts`
- **Source Export(s):** `getGitHookStatus`
- **Target File:** `internal/hooks/hooks.go`
- **Target Export:** `func GetGitHookStatus(rootDir string, options GitHookTargetOptions) (GitHookStatus, error)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native hooks`
- **TS Delegation Call:** Update `packages/engine/src/hooks.ts` to route execution of `getGitHookStatus` through our centralized `runGoSidecar` wrapper when `process.env.USE_GO_PORT` is enabled.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Go standard libraries (`os`, `path/filepath`, `strings`). Confirm that NO stubs, mocks, or unported TS files are required.
- **Go-to-Go Native Imports:** `swarmvault-native/internal/utils` (for `FileExists`). Explicitly state that Go must call Go natively; it must never use the subprocess bridge.
- **Transitive Blocks:** Stubbing is forbidden. All hook status checking logic must be implemented fully in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code.
- **Function Limit:** Max 80 Lines of Code. Extract path lookups into smaller helper functions (e.g. `findNearestGitRoot`).
- **Nesting Limit:** Maximum of 3 levels deep. Use early exits and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures across both TS and Go to verify identical output.
