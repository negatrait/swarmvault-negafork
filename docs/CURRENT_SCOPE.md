# Daily Porting Scope: internal/parser/markdown_ast.go

## 1. Goal
Port the document parsing function `parseMarkdownNodes` from `packages/engine/src/markdown-ast.ts` to Go under `internal/parser/markdown_ast.go`. This module provides parsing and node extraction features for Markdown text, establishing a critical foundation for document processing in the standalone native Go CLI.
  - **Metrics:** Fully implement the AST parsing function `parseMarkdownNodes` cleanly in Go, achieving 100% test parity via `/shared-fixtures`. The target TS file exceeds 150 lines, so we strictly scope exactly ONE leaf function (`parseMarkdownNodes`).
  - **Pitfalls:** Ensure Go structurally mirrors the AST processing of the TypeScript `mdast-util-from-markdown` dependency. Use a robust Go library like `github.com/yuin/goldmark` or match the data structures directly.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/markdown-ast.ts`
- **Source Export(s):** `parseMarkdownNodes`
- **Target File:** `internal/parser/markdown_ast.go`
- **Target Export:** `ParseMarkdownNodes`

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native parser` (specifically handling the `parseMarkdownNodes` action).
- **TS Delegation Call:** Update `packages/engine/src/markdown-ast.ts` to route execution of `parseMarkdownNodes` through our centralized `runGoSidecarSync` wrapper with action type `parseMarkdownNodes`.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** `regexp`, `strings`, `encoding/json` and any well-regarded third party library suitable for Markdown parsing to AST (such as `yuin/goldmark`) to mimic the TypeScript mdast library. No stubs or dummy outputs are permitted.
- **Go-to-Go Native Imports:** `swarmvault-native/internal/types` for data models like `MarkdownNode`.
- **Transitive Blocks:** The builder must implement the core AST logic fully in Go without mocks, delegating only native types and ported utilities.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Maximum 400 Lines of Go Code. Extract types into `internal/types/parser.go` if the file size approaches the limit.
- **Function Limit:** Maximum 80 Lines of Code per function.
- **Nesting Limit:** Maximum of 3 levels deep. Utilize early exits and guard clauses extensively.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1, specifically adhering to the `MarkdownNode` recursive definition type.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output (e.g. same text fragments and node depths).