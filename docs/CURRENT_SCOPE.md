# Daily Porting Scope: graph-share (sortedFallbackHubs)

## 1. Goal
Port exactly one leaf function, `sortedFallbackHubs`, from the 483-line `packages/engine/src/graph-share.ts` into the Go package `internal/graph`. This follows the Slicing Decision Tree constraint for files over 150 lines (scoping exactly one leaf function to prevent timeouts).
  - **Success Metrics:** The Go CLI subcommand `graph` accepts a JSON payload containing the `graph` argument, executes the sorting algorithm for nodes, and returns a 1:1 matching JSON response containing an array of `GraphNode`.
  - **Identified Pitfalls:** We must replicate the Node.js `localeCompare` string comparison used as a tie-breaker. `strings.Compare` in Go handles exact lexical sorting which aligns with typical default locale behaviors. Null/undefined values (`degree ?? 0`) translate to zero-values in Go structs, so we must be precise when dealing with struct pointers vs concrete values.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/graph-share.ts`
- **Source Export(s):** `sortedFallbackHubs` (internal utility, not exported)
- **Target File:** `internal/graph/share.go`
- **Target Export:** `SortedFallbackHubs`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native graph`
- **TS Delegation Call:** Update `sortedFallbackHubs` in `packages/engine/src/graph-share.ts` to delegate to `runGoSidecarSync<GraphNode[]>("graph", { action: "sortedFallbackHubs", args: { graph } })` when `USE_GO_PORT=true`.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go library (`sort`, `strings`).
- **Go-to-Go Native Imports:** `swarmvault-native/internal/utils` for JSON decoding/encoding in the CLI handler, and `swarmvault-native/internal/types` (or equivalent) for the `GraphArtifact` and `GraphNode` structures.
- **Transitive Blocks:** None. This function is a pure algorithmic leaf that sorts an array. Stubbing is strictly forbidden.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. `share.go` will be small.
- **Function Limit:** Max 80 Lines of Code. `SortedFallbackHubs` will easily fit.
- **Nesting Limit:** Max 3 levels deep. The sort callback will be flat.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Array order must be perfectly identical to the TS output when tie-breaking by `degree`, `bridgeScore`, and `label`.
- Unit tests must run identical JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
