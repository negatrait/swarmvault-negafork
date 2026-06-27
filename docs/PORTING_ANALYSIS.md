# Porting SwarmVault: Architecture Analysis & Roadmap

## Executive Summary

This document analyzes the strategies and benefits of porting sections of SwarmVault to a compiled native language. The analysis is driven by the following primary goals:

1. **Shrink the Memory Footprint:** Reduce memory consumption, particularly during massive graph ingestion and compilation.
2. **Standalone Binary:** Enable compilation into a high-performance, statically linked, standalone CLI executable that requires zero runtime dependencies (no Node.js runtime required).

We are explicitly rejecting two traditional extremes:
1. **The Greenfield Rewrite:** Re-architecting from scratch in Go is rejected. It introduces massive regression risks, delays value delivery, and violates Hyrum's Law by discarding decades of implicit edge cases, parser workarounds, and bug fixes built into our TS codebase.
2. **The Loose Polyglot Bridge:** Maintaining a heavy inter-process JSON bridge long-term is rejected. It introduces performance bottlenecks and double-tooling maintenance overhead.

Instead, we are adopting a **Structural Port**, modeled directly on Microsoft's port of the TypeScript compiler and typechecker to Go (`tsgo`). We will translate our TypeScript codebase module-by-module into Go while **deliberately preserving the original directory structures, data models, logic flow, and function contracts 1:1**.

## A. Directory & Package Mirroring Strategy

To ensure developers can instantly map logic between the two codebases during the migration, the Go codebase must mirror the TypeScript codebase directory layout exactly:
- `src/parser/markdown.ts` -> `internal/parser/markdown.go`
- `src/graph/louvain.ts` -> `internal/graph/louvain.go`

## B. Data Model & Contract Mapping (TS to Go)

Direct translation rules must be followed to show how TypeScript concepts map to idiomatic yet structurally equivalent Go:
- TS Interfaces and Type aliases map to Go `struct` and `interface` models.
- TS `Promise` and asynchronous structures map to Go's synchronous execution paths (leveraging Go's runtime scheduler) or direct goroutine/channel pipelines where high concurrency is required.
- Do not let the Go code deviate into entirely new design patterns; preserve the algorithmic flow to ensure logic remains easily verifiable.

### Example Code Structure

This is a conceptual illustration of this 1:1 structural mapping:

**TypeScript Source (`src/graph/community.ts`):**
```typescript
export interface GraphNode {
  id: string;
  weight: number;
}

export function detectCommunities(nodes: GraphNode[], resolution: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const node of nodes) {
    result[node.id] = Math.floor(node.weight * resolution);
  }
  return result;
}
```

**Ported Go Code (`internal/graph/community.go`):**
```go
package graph

type GraphNode struct {
	ID     string  `json:"id"`
	Weight float64 `json:"weight"`
}

func DetectCommunities(nodes []GraphNode, resolution float64) map[string]int {
	result := make(map[string]int)
	for _, node := range nodes {
		result[node.ID] = int(node.Weight * resolution)
	}
	return result
}
```

## Incremental Migration Architecture (The "Sidecar" Strategy)

Migrating the entire codebase at once is risky and disruptive. Instead, we will adopt the **Subprocess/CLI Sidecar Bridge Pattern** to migrate "one function at a time." The roadmap must detail how we swap TS code for Go code safely through the **Incremental "Toggled" Release Loop**:

1. **Port the Module:** Translate the module 1:1 from TS to Go.
2. **Expose Subcommand:** Expose the ported module as a subcommand in the emerging Go CLI.
3. **Bridge & Toggle:** Update the TS codebase to delegate to the Go CLI subcommand via a child subprocess. Keep the legacy TS implementation behind an environment variable toggle (e.g., `USE_GO_PARSER=true`).
4. **Assert & Validate:** Run live data through both paths, validating output parity.
5. **Deprecate:** Remove the legacy TS module once performance and accuracy are proven.

## Analyzing Subprocess Sidecar Limits & Overhead

While the sidecar strategy allows for an incremental migration, **spinning up a child process incurs a severe performance penalty** due to OS context switching, process initialization, and JSON serialization/deserialization across standard I/O streams.

These overheads become critically exposed in two specific scenarios:

1.  **Tight Loops (CI Timeouts):** Iterating through thousands of items in TypeScript and calling `runGoSidecar` or `runGoSidecarSync` on every single iteration causes catastrophic slowdowns. This pattern frequently triggers CI job timeouts as the system thrashes trying to spawn and tear down processes rapidly.
2.  **High-Frequency Utility Functions:** Fine-grained functions (e.g., small string manipulations, path normalization, small mathematical assertions) that execute hundreds or thousands of times across the orchestrator codebase. The IPC bridge transit time completely eclipses the execution time of the actual Go logic.

To mitigate this, the architecture strictly demands **"Batching & Idiomatic Go Concurrency"** and **"Lifting the Bridge"** (detailed in `MIGRATION_SPEC.md`).

## High-Impact Areas for Porting

If porting incrementally, these sections of the SwarmVault `@swarmvaultai/engine` will yield the highest ROI for memory footprint reduction.

### A. Graph Compilation & Algorithms (Louvain / Graphology)
SwarmVault currently relies on JavaScript implementations for graph data structures and community detection. Loading thousands of nodes/edges balloons the V8 heap and causes garbage collection thrashing.

*   **Proposed Port:** Go.
*   **Benefit:** Go's efficient struct packing and pointer management allows dense graph representation in memory. A graph taking 1GB in Node.js might take ~100MB in Go.

### B. Document Ingestion, Chunking & AST Parsing
Reading large PDFs, DOCX, and processing Markdown to AST creates thousands of small transient objects.

*   **Proposed Port:** Go.
*   **Benefit:** Goroutines allow highly parallelized document ingestion. Streaming parsers in Go can read gigabytes of data without loading entire documents into RAM.

---

## Best Practices to Follow (Verified Node.js stdio patterns)

When implementing the Sidecar strategy, adhere to these established patterns for Node.js `child_process.spawn`:

1.  **Strict stdio configuration:** Avoid using default `'pipe'` for file descriptors you do not intend to use. Explicitly map `stdio: ["pipe", "pipe", "pipe"]` (or `"ignore"` for stdin if passing arguments via CLI flags) to guarantee structured IPC.
2.  **Buffer memory limits:** When expecting large JSON payloads from the Go sidecar over `stdout`, use streaming parsers or chunk accumulation (e.g., `child.stdout.on("data", ...)`). Do not rely solely on `exec` due to its restrictive buffer limits.
3.  **Error channel segregation:** Always pass structured JSON results back on `stdout` and reserve `stderr` purely for logging, error tracing, and debugging text. This prevents malformed JSON parsing errors.

---

## Common Pitfalls to Avoid

When executing this migration, particularly in our current environment, watch out for:

1.  **pnpm workspace hoisting hurdles:** The Node.js `spawn` execution environment (especially `process.env.PATH` and `cwd`) can be unpredictable when running within a hoisted pnpm monorepo. **Always resolve absolute paths** to the compiled Go sidecar binary before calling `spawn()`. Do not rely on relative paths or `npx/pnpm exec` wrappers for the Go binary.
2.  **Dangling subprocesses:** If the TypeScript orchestrator crashes or is forcibly killed by the user, spawned Go subprocesses might become orphaned. Implement structured teardown hooks (listening to Node's `SIGTERM`/`SIGINT`) to explicitly call `child.kill()` on active sidecars.
3.  **Cross-platform binary resolution:** Ensure the TypeScript wrapper dynamically resolves the correct binary extension (e.g., `.exe` on Windows) and verifies the Go binary exists and has execute permissions before spawning.

---

## Example Snippets: Real Codebase Patterns

These 3 examples reflect real code patterns currently used in SwarmVault (`packages/engine/src/...`) adapted for the new Go sidecar architecture.

### Example 1: The Go CLI Sidecar (JSON via stdio)
```go
// cmd/swarmvault-native/main.go
package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type GraphPayload struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}
type Node struct{ ID string `json:"id"` }
type Edge struct{ Source, Target string `json:"source", "target"` }

func main() {
	if len(os.Args) > 1 && os.Args[1] == "detect-communities" {
		var data GraphPayload

		// Receive graph payload via stdin
		if err := json.NewDecoder(os.Stdin).Decode(&data); err != nil {
			// Write strictly to stderr to preserve stdout for valid JSON
			fmt.Fprintf(os.Stderr, "Error decoding JSON: %v\n", err)
			os.Exit(1)
		}

		// Run memory-efficient graph operation
		communities := runLouvainFast(data.Nodes, data.Edges)

		// Return strictly structured result via stdout
		if err := json.NewEncoder(os.Stdout).Encode(communities); err != nil {
			os.Exit(1)
		}
	}
}

func runLouvainFast(nodes []Node, edges []Edge) map[string]int {
	return map[string]int{"nodeA": 1, "nodeB": 1}
}
```

### Example 2: The TypeScript Bridge (Promise-wrapped `spawn`)
*Pattern derived from `packages/engine/src/extraction.ts` and `providers/local-whisper.ts`.*

```typescript
// engine/src/graph/compile.ts
import { spawn } from 'node:child_process';
import path from 'node:path';

export async function runGoSidecar(subcommand: string, inputPayload: any): Promise<any> {
    return new Promise((resolve, reject) => {
        // Resolve absolute path to avoid pnpm workspace cwd confusion
        const binaryPath = path.resolve(__dirname, '../../../bin/swarmvault-native');

        // Explicitly define stdio routing
        const child = spawn(binaryPath, [subcommand], {
             stdio: ["pipe", "pipe", "pipe"]
        });

        let stdout = '';
        let stderr = '';

        // Accumulate chunks (vital for large JSON returns)
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Go sidecar failed (code ${code}): ${stderr}`));
            }
            resolve(JSON.parse(stdout));
        });

        // Pass the heavy graph data via stdin
        child.stdin.write(JSON.stringify(inputPayload));
        child.stdin.end();
    });
}
```

### Example 3: Subprocess Orchestration with Environment Inheritance
*Pattern derived from `packages/engine/src/orchestration.ts`.*

When the Go sidecar needs access to API keys (e.g., for LLM ingestion), the TypeScript orchestrator must explicitly pass down the environment.

```typescript
// engine/src/orchestration.ts
import { spawn } from 'node:child_process';

interface SidecarConfig {
    command: string[];
    cwd?: string;
    env?: Record<string, string>;
}

export async function executeSidecarWithEnv(config: SidecarConfig) {
    const [binary, ...args] = config.command;

    const child = spawn(binary, args, {
        cwd: config.cwd,
        // Inherit base environment, but inject specific keys needed by the Go CLI
        env: {
            ...process.env,
            ...(config.env ?? {})
        },
        stdio: ["ignore", "pipe", "pipe"] // Ignore stdin if arguments are enough
    });

    // ... setup stdout/stderr listeners as in Example 2 ...
}
```

---

## Updated Phased Roadmap

To achieve the standalone Go CLI incrementally, the recommended path is:

1.  **Phase 1 (Setup & CLI Bridge):** Establish the Go CLI framework (`cmd/swarmvault-native`). Set up the IPC/subprocess bridge utility in the TypeScript orchestrator to handle standard stdin/stdout JSON passing.
2.  **Phase 2 (High-Impact Algorithmic Port):** Port heavy graph operations (community detection, Louvain) first to relieve immediate memory pressure in Node.js.
3.  **Phase 3 (I/O Porting):** Port document parsing, chunking, and file ingestion utilizing Go’s native concurrency (Goroutines) for massive parallel throughput.
4.  **Phase 4 (Final Handover):** Port the remaining orchestrator shell logic to Go. Fully deprecate the Node.js/TypeScript runtime and compile the final standalone Go binary for distribution.
