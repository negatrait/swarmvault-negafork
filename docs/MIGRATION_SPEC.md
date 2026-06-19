# SwarmVault TypeScript to Go Migration Specification

## 1. Objective & Core Principles

The goal is to incrementally migrate the SwarmVault `@swarmvaultai/engine` from TypeScript/Node.js to a standalone Go executable using a "Sidecar" subprocess pattern. This migration is driven by the need for a drastically reduced memory footprint (specifically avoiding V8 heap explosions on large graphs) and simplified distribution (zero Node.js runtime requirement for end users).

To prevent feature drift, regressions, and disruptions to users, the migration MUST adhere to the strict **"Structural Port"** paradigm (the "tsgo" model) and the following principles:

1.  **Zero-Downtime Installation:** End-user installations via `curl install.sh | bash` must continue to work flawlessly at every single commit on `main`.
2.  **Strict 1:1 Feature Parity:** Output from the Go implementations must identically match the TypeScript implementations (down to JSON formatting expectations).
3.  **Shadow Execution First:** No Go module becomes the primary execution path without first running in "shadow mode" alongside the TypeScript implementation in CI to prove mathematical and structural parity.
4.  **Preserve the Outer API:** The CLI arguments and existing exported interfaces from `@swarmvaultai/engine` must not change during the incremental phases. Only the internal execution layer changes.
5.  **Structural Port:** We explicitly reject both the "Greenfield Rewrite" and the "Loose Polyglot Bridge". We will translate our TypeScript codebase module-by-module into Go while deliberately preserving the original directory structures, data models, logic flow, and function contracts 1:1.

---

## 2. Architecture & Tooling

We will adopt the **Subprocess/CLI Sidecar Bridge Pattern**.

*   **Go Module Location:** `cmd/swarmvault-native` (or `packages/native`).
*   **The Orchestrator:** The existing Node.js application (`@swarmvaultai/cli` / `@swarmvaultai/engine`).
*   **The Bridge:** A TypeScript utility (e.g., `runGoSidecar()`) using `node:child_process.spawn`.
*   **IPC (Inter-Process Communication):** Strict JSON via `stdin` and `stdout`. `stderr` is reserved exclusively for logging and error reporting.

---

## 3. CI/CD & Build Pipeline Adjustments

To ensure continuous release readiness, the build pipeline must be updated early in the migration:

1.  **`pnpm build` Integration:** Modify the root `pnpm build` script (or `packages/engine` build script) to invoke `go build` automatically if the Go compiler is present in the environment.
2.  **`install.sh` Updates:** The install script must be updated to either:
    *   Verify `go` is installed and compile the native binary during local installation.
    *   (Preferred long-term) Download pre-compiled Go binaries based on `$GOOS` and `$GOARCH` to remove the Go compilation burden from end users.
3.  **GitHub Actions:** Add a setup step for Go (`actions/setup-go`) to all relevant CI workflows (`test`, `build`, `live-smoke`).

---

## 4. Differential Parity Testing

Testing is at the absolute center of the migration. Before a Go module replaces a TypeScript module, it must pass these parity tests:

1.  **Shared Fixtures Validation:** The monorepo must maintain a shared `/shared-fixtures` directory containing standardized inputs (Markdown documents, graph nodes/edges).
2.  **Differential Testing:** The CI/CD pipeline must feed the identical inputs from `/shared-fixtures` into both the TS implementation and the new Go implementation, asserting that both runtimes generate identical, byte-for-byte JSON outputs.
3.  **Dual-Run Shadow Mode (CI Only):** When a specific feature is executed in CI, the TS orchestrator will run the existing TS logic *and* spawn the Go sidecar. It will perform a deep JSON equality check on both results. Any deviation fails the test suite.
4.  **Performance Benchmarks:** A vitest `bench` suite must measure memory usage and execution time. The Go sidecar must demonstrate significant memory reduction (and equal or better speed) before approval.

---

## 5. Granular Migration Sequence: The "Toggled" Release Loop

The roadmap details how we swap TS code for Go code safely across small, reviewable Pull Requests (PRs). Each port must follow this 5-step loop:
1. **Port the Module:** Translate the module 1:1 from TS to Go.
2. **Expose Subcommand:** Expose the ported module as a subcommand in the emerging Go CLI.
3. **Bridge & Toggle:** Update the TS codebase to delegate to the Go CLI subcommand via a child subprocess. Keep the legacy TS implementation behind an environment variable toggle (e.g., `USE_GO_PARSER=true`).
4. **Assert & Validate:** Run live data through both paths, validating output parity using `/shared-fixtures`.
5. **Deprecate:** Remove the legacy TS module once performance and accuracy are proven.

### Phase 1: Foundation (Scaffolding & IPC Bridge)
*   **PR 1.1:** Create `cmd/swarmvault-native` directory, `go.mod`, and a basic `main.go` that parses a simple dummy JSON payload from `stdin` and returns it on `stdout`.
*   **PR 1.2:** Implement the TypeScript IPC bridge utility (`runGoSidecar`) in `@swarmvaultai/engine`. Add basic unit tests ensuring Node.js can successfully spawn the compiled Go binary, send data, and parse the return JSON.

### Phase 2: CI/CD & Distribution Cutover
*   **PR 2.1:** Update GitHub Actions workflows (`.github/workflows/*.yml`) to include Go compilation steps. Ensure the build passes.
*   **PR 2.2:** Update `install.sh` and `package.json` build scripts to compile the Go sidecar locally alongside the TS build. Verify a clean installation works locally.

### Phase 3: Shadow Migration (Graph Algorithms)
*   **PR 3.1 (Go Logic):** Implement the Louvain community detection algorithm in Go, mirroring TS models to Go structs 1:1.
*   **PR 3.2 (Shadow Mode):** Update the TS orchestrator to run the Go Louvain implementation in shadow mode alongside the TS version during `pnpm test`. Assert output against shared fixtures.
*   **PR 3.3 (Cutover):** Once parity is proven and benchmarks confirm memory reduction, swap the primary execution path to use the Go sidecar via an environment toggle.

### Phase 4: Shadow Migration (I/O & Parsing)
*   **PR 4.1:** Implement parallel document ingestion (PDF, Markdown) and chunking in Go using Goroutines, mimicking TS behavior exactly.
*   **PR 4.2:** Run the Go ingestion logic in shadow mode against the TS parsers using `/shared-fixtures`. Resolve edge cases in AST generation.
*   **PR 4.3:** Swap the primary execution path for document parsing to the Go sidecar via an environment toggle.

### Phase 5: The Shell Cutover
*   **PR 5.1:** Re-implement the CLI argument parsing and top-level orchestration (`@swarmvaultai/cli` equivalent) directly in Go.
*   **PR 5.2:** Update `install.sh` to link the new standalone Go executable globally instead of the Node.js wrapper.
*   **PR 5.3:** Deprecate and remove the old TypeScript `@swarmvaultai/engine` and `@swarmvaultai/cli` packages.

---

## 6. Rollback & Incident Mitigation

During Phase 3 and Phase 4, the TypeScript implementation will not be immediately deleted.

*   **Feature Flags:** We will utilize environment variables (e.g., `SWARMVAULT_USE_TS_FALLBACK=1`) to allow end users to force the CLI to use the old Node.js implementations if the Go sidecar fails in their specific environment or on edge-case data.
*   **Automatic Fallback:** The IPC bridge should be wrapped in a `try/catch`. If the Go subprocess crashes (e.g., exit code > 0) or times out, the orchestrator should automatically log a warning to `stderr` and transparently fall back to the TS implementation to ensure the user's workflow is not interrupted.

---

### 7. Organising the Go Codebase

As your Go CLI expands, keeping all your subcommands, logic, and JSON parsing in `main.go` will quickly lead to a bloated, unmaintainable codebase. In idiomatic Go, `main.go` should act purely as a **slim entry point** [1.2].

To offload weight from `main.go` while keeping your structural port clean, you can adopt the standard **`cmd` and `internal` packages layout** [1.2]. This separates the CLI command orchestration from the actual domain logic [1.2].

#### 7.1. The Target Directory Layout

By organizing your Go code this way, you mirror the modular layout of your TypeScript packages:

```text
swarmvault/
├── cmd/
│   └── swarmvault-native/
│       └── main.go              # Pure entry point (usually under 20 lines)
└── internal/
    ├── cmd/                     # CLI Subcommand handlers (reads stdin, writes stdout)
    │   ├── root.go              # CLI engine setup (e.g., using Cobra or standard flag library)
    │   ├── detect_communities.go# Handlers for specific ported subcommands
    │   └── chunk_document.go
    ├── graph/                   # Pure business logic: Algorithms & Data Structures
    │   └── louvain.go           # Community detection implementation (no CLI code)
    └── parser/                  # Pure business logic: Document parsing
        └── markdown.go
```

#### 7.2. Implementation Blueprints

##### 7.2.A. The New Slim `cmd/swarmvault-native/main.go`
Your main entry point should do nothing more than call your command dispatcher [1.2]:

```go
package main

import (
	"log"

	"swarmvault-native/internal/cmd"
)

func main() {
	// Hand off all execution to the CLI package
	if err := cmd.Execute(); err != nil {
		log.Fatalf("Execution failed: %v", err)
	}
}
```

##### 7.2.B. The Command Dispatcher (`internal/cmd/root.go`)
If you are using the standard library, you can write a lightweight dispatcher. If your CLI is complex, using a library like **Cobra** is highly recommended. Here is a simple, standard-library multiplexer:

```go
package cmd

import (
	"errors"
	"fmt"
	"os"
)

// Execute parses the subcommand and delegates to the correct file
func Execute() error {
	if len(os.Args) < 2 {
		printUsage()
		return errors.New("missing subcommand")
	}

	subcommand := os.Args[1]
	switch subcommand {
	case "detect-communities":
		return handleDetectCommunities() // defined in detect_communities.go
	case "chunk-document":
		return handleChunkDocument()     // defined in chunk_document.go
	default:
		printUsage()
		return fmt.Errorf("unknown subcommand: %s", subcommand)
	}
}

func printUsage() {
	fmt.Fprintln(os.Stderr, "Usage: swarmvault-native <subcommand> [args]")
	fmt.Fprintln(os.Stderr, "Subcommands:")
	fmt.Fprintln(os.Stderr, "  detect-communities")
	fmt.Fprintln(os.Stderr, "  chunk-document")
}
```

##### 7.2.C. Isolating Command Handlers (`internal/cmd/detect_communities.go`)
This file is dedicated solely to handling the CLI/bridge contract: parsing JSON from `os.Stdin` and passing it to the core library.

```go
package cmd

import (
	"encoding/json"
	"os"
	"swarmvault-native/internal/graph"
)

func handleDetectCommunities() error {
	var input graph.CommunityInput
	if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
		return err
	}

	// Delegate processing to the pure graph package
	result := graph.DetectCommunities(input.Nodes, input.Edges)

	return json.NewEncoder(os.Stdout).Encode(result)
}
```

##### 7.2.D. The Pure Core Package (`internal/graph/louvain.go`)
Your actual algorithm logic remains completely isolated from CLI code, environment variables, or standard streams [1.2]. This makes it extremely easy to test using standard Go unit tests (`go test`).

```go
package graph

type Node struct {
	ID     string  `json:"id"`
	Weight float64 `json:"weight"`
}

type Edge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

type CommunityInput struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

func DetectCommunities(nodes []Node, edges []Edge) map[string]int {
	communities := make(map[string]int)
	// Pure algorithmic code here
	for i, node := range nodes {
		communities[node.ID] = i
	}
	return communities
}
```

#### 7.3. Benefits of this Refactoring for Your Structural Port

1. **Aligns 1:1 with TypeScript Modules:** Your TS codebase likely has separate folders for utilities, database operations, and server endpoints. Moving code into `internal/graph`, `internal/parser`, etc., allows you to maintain clean directory mirroring.
2. **Untangled Testing:** You can write fast, standard unit tests for your algorithms directly inside `internal/graph/louvain_test.go` without needing to mock stdin/stdout or run CLI shell processes.
3. **No Collision Scope:** Variables, helper functions, and types are private to their respective packages, eliminating name collision issues as you port more files from your TS codebase.
