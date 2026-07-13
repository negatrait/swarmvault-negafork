# Daily Porting Scope: graph-enrichment (Topic & Module Hyperedges)

## 1. Goal
Port the leaf functions `buildTopicHyperedges` and `buildModuleFormHyperedges` from `packages/engine/src/graph-enrichment.ts` into a new Go package `internal/graph`.
  - **Success Metrics:** The Go CLI subcommand `graph` can receive `buildTopicHyperedges` and `buildModuleFormHyperedges` and return identical outputs.
  - **Identified Pitfalls:** Both functions rely on sorting strings and deduplicating arrays. We must replicate `uniqueBy` and string sorting behavior exactly to maintain parity.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/graph-enrichment.ts`
- **Source Export(s):** `buildTopicHyperedges`, `buildModuleFormHyperedges` (internal utilities, not exported)
- **Target File:** `internal/graph/enrichment.go`
- **Target Export:** `BuildTopicHyperedges`, `BuildModuleFormHyperedges`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native graph`
- **TS Delegation Call:** Update `buildTopicHyperedges` and `buildModuleFormHyperedges` in `packages/engine/src/graph-enrichment.ts` to delegate to `runGoSidecarSync<GraphHyperedge[]>("graph", { action: "buildTopicHyperedges", args: { graph } })` (and similarly for `buildModuleFormHyperedges`) when `USE_GO_PORT=true`.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go library (`sort`, `math`, `strings`).
- **Go-to-Go Native Imports:** `swarmvault-native/internal/utils` for JSON decoding/encoding and crypto (`Sha256String`), and `swarmvault-native/internal/types` for the `GraphArtifact` and `GraphHyperedge` structures.
- **Transitive Blocks:** None. These functions are pure algorithmic leaves. Stubbing is strictly forbidden.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. `enrichment.go` will be well under 200 lines.
- **Function Limit:** Max 80 Lines of Code. Each builder function will fit easily.
- **Nesting Limit:** Max 3 levels deep. Use early returns inside loops.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- The `id` hashes (SHA256) and computed `confidence` values must match exactly.
- Array order must be perfectly identical to the TS output when tie-breaking string compares (use `strings.Compare`).
- Unit tests must run identical JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
