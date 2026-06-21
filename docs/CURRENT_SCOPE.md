# Daily Porting Scope: agents.ts

## 1. Goal
The goal of this scope is to port the `packages/engine/src/agents.ts` module to Go. This module handles installing, configuring, and checking the status of AI agents (hooks) inside a SwarmVault workspace. The port will maintain exact structural parity and test correctness.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/agents.ts`
- **Source Export:** `installAgent`, `getAgentInstallStatus`, `installConfiguredAgents`
- **Target File:** `internal/agents/agents.go`
- **Target Export:** `func InstallAgent(...)`, `func GetAgentInstallStatus(...)`, `func InstallConfiguredAgents(...)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native agents`
- **TS Delegation Call:** Update `packages/engine/src/agents.ts` to route execution through `child_process.spawnSync` to our native CLI if `process.env.USE_GO_PORT === 'true'`. The TS bridge wrapper should properly forward all necessary rootDir paths, options, and parse the output JSON.

## 4. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 500 Lines of Code. Split structs to `types.go` or sub-functions to separate files if approaching this limit.
- **Function Limit:** Max 80 Lines of Code. Helper functions must be extracted if exceeded.
- **Nesting Limit:** Maximum of 3 levels deep. Use early exits and guard clauses.

## 5. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same test cases across both TS and Go to verify identical output.
