# Daily Porting Scope: confidence.ts

## 1. Goal
Port the pure math and array filtering functions from `src/confidence.ts` to Go. These functions are used for calculating node, edge, and conflict confidence scores within the graph. This is an extremely small, atomic, and safe porting task to advance the structural porting effort.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/confidence.ts`
- **Source Export:** `function nodeConfidence`, `function edgeConfidence`, `function conflictConfidence`
- **Target File:** `internal/confidence/confidence.go`
- **Target Export:** `func NodeConfidence`, `func EdgeConfidence`, `func ConflictConfidence`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native confidence`
- **TS Delegation Call:** Update `packages/engine/src/confidence.ts` to route execution for all three functions through `runGoSidecarSync("confidence", { action: "<actionName>", args: { ... } })` if `process.env.USE_GO_PORT === 'true'`.

## 4. Stubs, Mocks, & Out-Of-Scope (Strict Protection)
- **What to Stub/Mock in Go:** No stubs or mocks are required. The module relies solely on standard math and the `SourceClaim` interface, which should be represented as a struct in `internal/types/types.go` or within the confidence package directly if not globally ported.
- **What to Ignore/Leave in TS:** None. The file is completely scoped to these 3 pure functions.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Code. Split structs to `types.go` or sub-functions to separate files if approaching this limit.
- **Function Limit:** Max 80 Lines of Code. Helper functions must be extracted if exceeded.
- **Nesting Limit:** Maximum of 3 levels deep. Use early exits and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
