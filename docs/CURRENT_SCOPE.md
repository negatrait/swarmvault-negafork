# Daily Porting Scope: graph-interchange

## 1. Goal
Port the leaf function `exportHyperedgeNodeId` from `packages/engine/src/graph-interchange.ts` to Go under `internal/graph`. The file is over 150 lines (152 lines), so we are applying the Slicing Decision Tree and scoping exactly one leaf function to prevent timeouts and keep differential testing reliable.
  - **Metrics:** `internal/graph/interchange.go` created. The single function `ExportHyperedgeNodeId` is fully implemented in Go.
  - **Pitfalls:** Ensure string formatting matches the TypeScript output exactly to prevent mismatch in downstream neo4j queries.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/graph-interchange.ts`
- **Source Export(s):** `exportHyperedgeNodeId`
- **Target File:** `internal/graph/interchange.go`
- **Target Export:** `ExportHyperedgeNodeId`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native graph`
- **TS Delegation Call:** Update `packages/engine/src/graph-interchange.ts` to route execution for `exportHyperedgeNodeId` through our centralized `runGoSidecarSync` wrapper using the "graph" subcommand and action "exportHyperedgeNodeId".

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries only (e.g. `fmt`). `swarmvault-native/internal/types` will be used for graph models (Artifact, Node, Edge, etc.). No unported dependencies or stubs are needed.
- **Go-to-Go Native Imports:** `swarmvault-native/internal/types`. This is a pure leaf function.
- **Transitive Blocks:** Stubbing is strictly forbidden. The logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This module will easily fit.
- **Function Limit:** Max 80 Lines of Code per function.
- **Nesting Limit:** Maximum of 3 levels deep. Use early returns and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
