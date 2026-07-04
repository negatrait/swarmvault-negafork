# Daily Porting Scope: renderChartSvg (output-artifacts)

## 1. Goal
Port the `renderChartSvg` leaf function from `output-artifacts.ts` to Go. This function is a pure, stateless utility for generating chart SVGs from JSON specifications.
  - Success metric: differential testing passes using shared fixtures across both TS and Go.
  - Identified pitfalls: string formatting, precision mismatches in float mapping, and ensuring XML escaping behavior matches TS identically.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/output-artifacts.ts`
- **Source Export(s):** `function renderChartSvg(...)`
- **Target File:** `internal/output-artifacts/output_artifacts.go`
- **Target Export:** `func RenderChartSvg(...)`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native output-artifacts`
- **TS Delegation Call:** Update `packages/engine/src/output-artifacts.ts` to route execution through our centralized `runGoSidecarSync` wrapper when `process.env.USE_GO_PORT` is enabled.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** Go standard libraries (`fmt`, `math`, `strings`). Confirm that NO stubs, mocks, or unported TS files are required.
- **Go-to-Go Native Imports:** None required.
- **Transitive Blocks:** Stubbing is forbidden. The SVG string generation must be implemented fully in Go.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. Split complex SVG generation logic into sub-functions if approaching this limit.
- **Function Limit:** Max 80 Lines of Code. Helper functions must be extracted to stay within this limit.
- **Nesting Limit:** Maximum of 3 levels deep. Use early exits and guard clauses.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
