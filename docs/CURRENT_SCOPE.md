# Daily Porting Scope: graph-interchange

## 1. Goal
Port the stateless utility file `packages/engine/src/graph-interchange.ts` to Go. This file is a pure leaf node and its entire contents will be ported in a single run. The physical audit of the Go codebase revealed NO stubs, TODOs, fakes or mocks. We are cleared to progress according to Scenario A of the migration decision tree.
  - **Metrics:** `internal/graph/interchange.go` created. The normalization and utility functions are fully implemented in Go.
  - **Pitfalls:** Ensure exact parity with the `cypherStringLiteral` escaping logic, including unicode code point escapes, to prevent invalid Cypher injection.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/graph-interchange.ts`
- **Source Export(s):** `exportHyperedgeNodeId`, `relationType`, `cypherStringLiteral`, `graphPageById`, `graphNodeById`, `normalizeSwarmNodeProps`, `normalizeHyperedgeNodeProps`, `normalizeEdgeProps`, `normalizeGroupMemberProps`, `filterGraphBySourceClasses`, `graphCounts`
- **Target File:** `internal/graph/interchange.go`
- **Target Export:** `ExportHyperedgeNodeId`, `RelationType`, `CypherStringLiteral`, `GraphPageById`, `GraphNodeById`, `NormalizeSwarmNodeProps`, `NormalizeHyperedgeNodeProps`, `NormalizeEdgeProps`, `NormalizeGroupMemberProps`, `FilterGraphBySourceClasses`, `GraphCounts`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native graph`
- **TS Delegation Call:** Update `packages/engine/src/graph-interchange.ts` to route execution for the functions through the centralized `runGoSidecarSync` wrapper using specific action payloads (e.g., `action: "cypherStringLiteral"`).

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries only (`fmt`, `strings`, `unicode`). `swarmvault-native/internal/types` will be used for the graph structs. No unported dependencies or stubs are needed.
- **Go-to-Go Native Imports:** `swarmvault-native/internal/types`. This is a pure leaf utility.
- **Transitive Blocks:** Stubbing is strictly forbidden. The logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This file is 153 lines in TS and will easily be under the limit in Go.
- **Function Limit:** Max 80 Lines of Code per function.
- **Nesting Limit:** Maximum of 3 levels deep. Use early returns and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.