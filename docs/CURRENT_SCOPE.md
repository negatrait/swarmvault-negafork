# Daily Porting Scope: marker-state (readWatchStaleness)

## 1. Goal
Port exactly one leaf function, `readWatchStaleness`, from the 430-line `src/hooks/marker-state.ts` into a new Go package `internal/hooks`. This follows the Slicing Decision Tree constraint for files over 150 lines (scoping exactly one leaf function to prevent timeouts).
  - **Success Metrics:** The Go CLI subcommand `hook-state` accepts a JSON payload containing the `cwd` argument, executes the filesystem reads for the watch status, and returns a 1:1 matching JSON response (or `null` if missing).
  - **Identified Pitfalls:** We must replicate Node's `fs.readFile` failure tolerance gracefully. Missing files or invalid JSON should safely return `null` or a partial state without panicking or returning hard CLI errors, exactly as the TS implementation catches those errors silently.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/hooks/marker-state.ts`
- **Source Export(s):** `readWatchStaleness` (and the `WatchStaleness` interface)
- **Target File:** `internal/hooks/marker_state.go`
- **Target Export:** `ReadWatchStaleness`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native hook-state`
- **TS Delegation Call:** Update `readWatchStaleness` in `packages/engine/src/hooks/marker-state.ts` to delegate to `runGoSidecarSync<WatchStaleness | null>("hook-state", { action: "readWatchStaleness", args: { cwd } })` when `USE_GO_PORT=true`.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries (`os`, `path/filepath`, `encoding/json`).
- **Go-to-Go Native Imports:** `swarmvault-native/internal/utils` for JSON decoding/encoding in the CLI handler, but the core function `ReadWatchStaleness` should only depend on standard library IO.
- **Transitive Blocks:** None. This function is a pure leaf that only interacts with the filesystem directly. Stubbing is strictly forbidden. We must fully implement the `status.json` and `pending-semantic-refresh.json` reads.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. `marker_state.go` will be very small.
- **Function Limit:** Max 80 Lines of Code. Extract JSON parsing to a private helper if it exceeds this (unlikely).
- **Nesting Limit:** Max 3 levels deep. Use early returns for `os.ReadFile` errors.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- The TS implementation returns `null` if neither file is found, but returns partial data if at least one is found. Go must replicate this exact existential flag (`found = false`).
- Missing or malformed JSON in the target files must be handled gracefully just like the empty `catch {}` blocks in TS.
- Unit tests must run identical JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
