# Daily Porting Scope: graph-enrichment (describeSimilarityReasons)

## 1. Goal
Port exactly one leaf function, `describeSimilarityReasons`, from the `packages/engine/src/graph-enrichment.ts` file into the Go package `internal/graph`. The source file is 538 lines long, so this follows the Slicing Decision Tree constraint for complex/stateful modules (scoping exactly one leaf function to prevent timeouts).
  - **Success Metrics:** The Go CLI subcommand `graph-enrichment` accepts a JSON payload containing an array of `SimilarityReason` strings, executes the switch/map logic, and returns a 1:1 matching string description.
  - **Identified Pitfalls:** We must replicate the Node.js `join(", ")` string formatting exactly. `reasons` could be undefined/null or empty, which translates to a specific fallback string "This link is inferred from multiple shared graph features."

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/graph-enrichment.ts`
- **Source Export(s):** `describeSimilarityReasons`
- **Target File:** `internal/graph/enrichment.go`
- **Target Export:** `DescribeSimilarityReasons`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native graph-enrichment`
- **TS Delegation Call:** Update `describeSimilarityReasons` in `packages/engine/src/graph-enrichment.ts` to delegate to `runGoSidecarSync<string>("graph-enrichment", { action: "describeSimilarityReasons", args: { reasons } })` when `USE_GO_PORT=true`.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go library (`strings`).
- **Go-to-Go Native Imports:** `swarmvault-native/internal/utils` for JSON decoding/encoding in the CLI handler (`internal/cmd/graph_enrichment.go` or similar).
- **Transitive Blocks:** None. This function is a pure stateless utility string formatter. Stubbing is strictly forbidden.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. `enrichment.go` will be small.
- **Function Limit:** Max 80 Lines of Code. `DescribeSimilarityReasons` will easily fit.
- **Nesting Limit:** Max 3 levels deep. The mapping switch statement will be flat.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run identical JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output string formatting.
