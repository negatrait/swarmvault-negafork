# Daily Porting Scope: agents.ts (Phase 1)

## 1. Goal
The previous attempt to port `packages/engine/src/agents.ts` stalled because it was too large. The goal of this hyper-focused scope is to strictly port ONLY the `getAgentInstallStatus` function and its required core data structures. We will establish the `internal/agents` directory and the basic bridge.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/agents.ts`
- **Source Export:** `function getAgentInstallStatus(...)` (Port ONLY this function!)
- **Target File:** `internal/agents/status.go` (and `types.go` for the struct)
- **Target Export:** `func GetAgentInstallStatus(...)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native agents`
- **Action:** `"getAgentInstallStatus"`
- **TS Delegation Call:** Update `packages/engine/src/agents.ts` inside `getAgentInstallStatus` to route execution through `runGoSidecar("agents", { action: "getAgentInstallStatus", args: { rootDir, agent, options } })` if `process.env.USE_GO_PORT === 'true'`.

## 4. Stubs, Mocks, & Out-Of-Scope (Strict Protection)
- **What to Ignore/Leave in TS:** Do NOT port `installAgent` or `installConfiguredAgents`. Leave them exactly as they are in TS. Do not write Go handlers for them.
- **What to Stub/Mock in Go:** `getAgentInstallStatus` relies on `primaryTargetPathForAgent` and `targetsForAgent`. You MUST port these two helper functions (and any constant maps they need, like `agentFileKinds`) into Go as private functions in `internal/agents/paths.go`. It also requires checking file existence; use `os.Stat` directly in Go instead of porting the `fileExists` utility.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 500 Lines of Code. Split structs to `types.go`, path helpers to `paths.go`, and the main status logic to `status.go`.
- **Function Limit:** Max 80 Lines of Code. Helper functions must be extracted if exceeded.
- **Nesting Limit:** Maximum of 3 levels deep. Use early exits and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Define `AgentInstallStatus` and `AgentInstallTargetStatus` structs in Go with explicit JSON tags.
- The TS execution output must identically match the Go execution output.

## 7. Few-shot Examples
Idiomatic examples and anti-patterns of TS to Go porting.

### Expected Go Outcome
```go
package agents

import "os"

// fileExists is a simple internal stub to avoid porting utils.ts
func fileExists(path string) bool {
    _, err := os.Stat(path)
    return err == nil
}
```

### Anti-pattern Go Outcome
Trying to port `initWorkspace` or heavy file operations from `utils.ts` just because they are in the same file. Do not port them! Stick strictly to `getAgentInstallStatus` dependencies!