# Daily Porting Scope: source-classification

## 1. Goal
Port the stateless utility file `packages/engine/src/source-classification.ts` to Go. This file is a pure leaf node and its entire contents will be ported in a single run. The physical audit of the Go codebase revealed NO stubs, TODOs, fakes or mocks. We are cleared to progress according to Scenario A of the migration decision tree.
  - **Metrics:** `internal/config/source_classification.go` created. The classification functions are fully implemented in Go.
  - **Pitfalls:** Ensure exact parity with the glob matching behavior for the `classifyRepoPath` function.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/source-classification.ts`
- **Source Export(s):** `classifyRepoPath`, `normalizeExtractClasses`, `aggregateSourceClass`, `aggregateManifestSourceClass`
- **Target File:** `internal/config/source_classification.go`
- **Target Export:** `ClassifyRepoPath`, `NormalizeExtractClasses`, `AggregateSourceClass`, `AggregateManifestSourceClass`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native config` (or generic handler in `cmd/swarmvault-native`)
- **TS Delegation Call:** Update `packages/engine/src/source-classification.ts` to route execution for the functions through the centralized `runGoSidecarSync` wrapper using specific action payloads (e.g., `action: "classifyRepoPath"`).

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Standard Go libraries only (`path/filepath`, `strings`). No external dependencies or stubs are needed.
- **Go-to-Go Native Imports:** None required. This is a pure leaf.
- **Transitive Blocks:** Stubbing is strictly forbidden. The logic must be fully implemented in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. This file will easily be under 150 lines.
- **Function Limit:** Max 80 Lines of Code per function.
- **Nesting Limit:** Maximum of 3 levels deep. Use early returns and guard clauses if necessary.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.