# Daily Porting Scope: ViewerGraphPresentation (graph-presentation)

## 1. Goal
Port the `ViewerGraphPresentation` functionality from `packages/engine/src/graph-presentation.ts` to Go. This file is a pure, stateless utility for filtering and sampling large graphs down to a constrained overview suitable for rendering in the UI without crashing the browser.
  - Success metric: differential testing passes using shared fixtures across both TS and Go.
  - Identified pitfalls: Stable sorting is crucial because sampling relies heavily on sorting nodes and communities by complex criteria (priority tuples). Tie-breakers must match TypeScript's `localeCompare` behavior exactly. Set iterations must also be deterministic if order matters.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/graph-presentation.ts`
- **Source Export(s):** `buildViewerGraphArtifact(...)`
- **Target File:** `internal/graph/graph_presentation.go`
- **Target Export:** `func BuildViewerGraphArtifact(...)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native graph`
- **TS Delegation Call:** Update `packages/engine/src/graph-presentation.ts` to route execution through our centralized `runGoSidecarSync` wrapper when `process.env.USE_GO_PORT` is enabled.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Go standard libraries (`sort`, `strings`, `cmp`). Confirm that NO stubs, mocks, or unported TS files are required.
- **Go-to-Go Native Imports:** `swarmvault-native/internal/types` (for GraphArtifact, GraphNode, etc). Explicitly state that Go must call Go natively; it must never use the subprocess bridge.
- **Transitive Blocks:** Stubbing is forbidden. All graph reduction logic (sampling, sorting, filtering) must be implemented fully in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. The entire TS file is 163 lines, so it should comfortably fit.
- **Function Limit:** Max 80 Lines of Code. Extract `sampleGraphNodes`, `pinnedNodeIdsForReport`, `survivingHyperedges`, `nodePriority`, and complex sorting comparators (`compareTuples`) into smaller helper functions.
- **Nesting Limit:** Maximum of 3 levels deep. Use early exits and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output. Ensure that array sorting is stable and produces exactly the same ordering as JS.
