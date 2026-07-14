# Daily Porting Scope: Fix Technical Debt (graph-enrichment)

## 1. Goal
Halt forward progression and fix the broken build in `internal/graph/enrichment.go`. The previous builder committed code with mismatched types (comparing strings to untyped nil), violating the Zero-Stubbing Mandate by leaving code that doesn't compile.
  - **Success Metrics:** The Go native sidecar compiles successfully (`pnpm build`).
  - **Identified Pitfalls:** The builder attempted to check if a string was nil (`anchor.Label != nil` and `moduleNode.Label != nil`) and attempted to dereference a string (`*anchor.Label` and `*moduleNode.Label`). Strings are value types in Go and cannot be nil unless they are pointers (`*string`). If the struct defines them as `string`, they must be checked against the empty string `""` and assigned directly.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/graph-enrichment.ts`
- **Target File:** `internal/graph/enrichment.go`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native graph`
- **TS Delegation Call:** No changes to TS bridge, fixing the underlying Go implementation.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard library `strings`.
- **Go-to-Go Native Imports:** None required for this fix.
- **Transitive Blocks:** You must fix the compilation error before proceeding with any new structural ports.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. `enrichment.go` will be well under this limit.
- **Function Limit:** Max 80 Lines of Code.
- **Nesting Limit:** Max 3 levels deep.

## 6. Parity Expectations
- The project must compile successfully via `pnpm build`.
- The Go implementation output for `buildTopicHyperedges` and `buildModuleFormHyperedges` must match the TS output.
