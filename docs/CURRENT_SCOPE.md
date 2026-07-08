# Daily Porting Scope: freshness

## 1. Goal
Port the batch processing function `applyDecayToPages` (and its required stateless mathematical helpers like `computeDecayScore`, `resolveHalfLifeForSourceClass`, etc.) from `src/freshness.ts` into a new Go package `internal/freshness`.
  - **Success Metrics:** The Go CLI subcommand `freshness` successfully accepts a JSON payload containing an array of `GraphPage` objects and a `DecayConfig`, processes them identically to the TS implementation, and returns the updated pages.
  - **Identified Pitfalls:** We must port the *batch* function `applyDecayToPages` rather than just the singular `computeDecayScore`. If we only bridged `computeDecayScore`, the TS loop in `applyDecayToPages` would trigger a sidecar subprocess per page, leading to severe CI timeouts ("Tight Loops" pitfall). We will port both to Go natively, and bridge the batch function.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/freshness.ts`
- **Source Export(s):** `applyDecayToPages`, `computeDecayScore`, `resolveDecayConfig`
- **Target File:** `internal/freshness/decay.go`
- **Target Export:** `ApplyDecayToPages`, `ComputeDecayScore`, `ResolveDecayConfig`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native freshness`
- **TS Delegation Call:** Update `applyDecayToPages` in `packages/engine/src/freshness.ts` to delegate to `runGoSidecarSync<ApplyDecayResult>("freshness", { action: "applyDecayToPages", args: { pages, config, now } })` when `USE_GO_PORT=true`.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries (`math`, `time`). The `types.GraphPage` and `types.DecayConfig` structs must be mapped or utilized if they exist in `internal/types`, otherwise added.
- **Go-to-Go Native Imports:** `swarmvault-native/internal/types` (for `GraphPage`, `SourceClass`, etc.)
- **Transitive Blocks:** None. This is pure JSON-in, JSON-out logic. Stubbing is strictly forbidden. The logic must exactly replicate the TS exponential decay math (`0.5 ^ (ageDays / halfLifeDays)`).

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 lines of Go code in `decay.go`.
- **Function Limit:** Max 80 lines of Go code per function.
- **Nesting Limit:** Max 3 levels deep per function.

## 6. Parity Expectations
- The exponential decay math must use `float64` and strictly map floating-point values for exact JSON parity.
- Missing or invalid dates must safely default to a decay score of `1`, exactly as TS does (`Date.parse` returning NaN).
- Unit tests must run identical JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
