# Daily Porting Scope: parseStoredPage (pages.ts)

## 1. Goal
Port the `parseStoredPage` function and its stateless normalization helpers from `packages/engine/src/pages.ts` to Go (`internal/pages/parse.go`). This function parses markdown files with YAML frontmatter into a `types.GraphPage` struct.
  - **Success Metrics:** `parseStoredPage` perfectly replicates `gray-matter` parsing behavior, and all normalizers perfectly map TS logic to Go.
  - **Identified Pitfalls:** We must use a robust YAML parser (e.g., `gopkg.in/yaml.v3`) instead of fragile regex to parse the frontmatter, matching `gray-matter` behavior. We must carefully map TS string dates to Go `time.Time` or ISO string formatting.

## 2. Source-to-Target Map
- **Source File:** `packages/engine/src/pages.ts`
- **Source Export(s):** `parseStoredPage`, `normalizeStringArray`, `normalizeProjectIds`, `normalizeSourceHashes`, `normalizeSourceSemanticHashes`, `normalizePageStatus`, `normalizePageManager`, `normalizeSourceType`, `normalizeSourceClass`, `normalizeOutputFormat`, `normalizeOutputAssets`, `inferPageKind`, `normalizeMemoryTier`
- **Target File:** `internal/pages/parse.go`
- **Target Export:** `func ParseStoredPage(relativePath string, content []byte, fallbackCreatedAt, fallbackUpdatedAt string) types.GraphPage` and associated unexported normalizers.

## 3. Subcommand & Bridge Contract
- **CLI Subcommand:** `swarmvault-native pages` (action: "parseStoredPage")
- **TS Delegation Call:** Update `parseStoredPage` in `packages/engine/src/pages.ts` to route execution through `runGoSidecarSync` using the `pages` subcommand.

## 4. Leaf Dependency Mapping (Strictly Zero-Stubs)
- **Verified Go Dependencies:** `gopkg.in/yaml.v3` (must be added to `go.mod`), standard libraries (`strings`, `path`).
- **Go-to-Go Native Imports:** `swarmvault-native/internal/types`, `swarmvault-native/internal/utils` (for slugify).
- **Transitive Blocks:** Zero stubs or mocks are permitted. The Go parser must fully handle the frontmatter and body separation, matching the exact struct schema of `types.GraphPage`.

## 5. Code Size & Complexity Restrictions (Strict)
- **File Limit:** Max 400 Lines of Go Code. `parse.go` will be well under this limit.
- **Function Limit:** Max 80 Lines of Code. Extract the YAML unmarshaling and struct field mapping into smaller helpers.
- **Nesting Limit:** Max 3 levels deep.

## 6. Parity Expectations
- Input/Output schema must match structurally 1:1.
- Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
- `gray-matter` behavior (parsing YAML between `---` fences at the top of the file) must be perfectly replicated.
