# Porting SwarmVault: Architecture Analysis & Roadmap

## Executive Summary

This document analyzes the strategies and benefits of porting sections of SwarmVault to a compiled native language. The analysis is driven by the following primary goals:

1. **Shrink the Memory Footprint:** Reduce memory consumption, particularly during massive graph ingestion and compilation.
2. **Standalone Binary:** Enable compilation into a high-performance, statically linked, standalone CLI executable that requires zero runtime dependencies (no Node.js runtime required).

*Note: WebAssembly (WASM) has been formally de-prioritized as a constraint. Because WASM compatibility is no longer a strict requirement for our roadmap, it allows us to choose a primary language solely optimized for standalone CLI distribution and developer velocity.*

## Language Analysis (Go as Primary Path)

With WASM constraints removed, **Go** is the primary recommended path for our standalone CLI pivot. It eliminates the high cognitive load and complex compilation chains associated with Rust, while delivering the performance profile we need.

*   **Key Benefits of Go for SwarmVault:**
    *   **Graph Representation Simplicity:** Go’s garbage collection and straightforward pointer model allow us to write traditional node-and-link graph structures cleanly. This bypasses Rust’s strict borrow-checker hurdles when dealing with cyclical or heavily interconnected graph data.
    *   **Frictionless Cross-Compilation:** Go provides out-of-the-box support for compiling native binaries across macOS (Intel/M-series), Linux, and Windows with simple environment variables (`GOOS`/`GOARCH`), requiring zero external C-toolchains.
    *   **High Concurrency Performance:** Goroutines and channels are perfect for fast parallel document parsing, chunking, and managing rate-limited LLM API ingestion.
    *   **Low Overhead:** Go produces standalone binary sizes of 10–15MB, which are optimal for CLI distribution. The memory footprint during heavy operations is vastly smaller and more predictable than the V8/Node.js runtime.

## Incremental Migration Architecture (The "Sidecar" Strategy)

Migrating the entire codebase at once is risky and disruptive. Instead, we will adopt the **Subprocess/CLI Sidecar Bridge Pattern** to migrate "one function at a time."

1.  **The Orchestrator:** The existing TypeScript codebase remains the primary application orchestrator.
2.  **The Sidecar:** The new Go CLI exposes specific subcommands for individual ported modules (e.g., `swarmvault-native detect-communities`).
3.  **The Bridge:** The TypeScript codebase spawns the Go binary as a subprocess. Input data is streamed or passed as JSON via `stdin`, and the Go process returns results as JSON via `stdout`.
4.  **The Shrinking Shell:** As more functions are migrated to Go subcommands, the TypeScript shell shrinks. Eventually, the TypeScript application is fully deprecated, resulting in a 100% native Go application.

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

## Example Snippets: The Sidecar Bridge Pattern

This example demonstrates how porting a memory-heavy graph operation using the Subprocess Bridge Pattern would look.

### 1. Go CLI Subcommand (The Sidecar)
```go
// main.go
package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type GraphData struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

type Node struct {
	ID string `json:"id"`
}

type Edge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "detect-communities" {
		var data GraphData

		// Receive graph payload via stdin
		if err := json.NewDecoder(os.Stdin).Decode(&data); err != nil {
			fmt.Fprintf(os.Stderr, "Error decoding JSON: %v
", err)
			os.Exit(1)
		}

		// Run memory-efficient graph operation
		communities := runLouvainFast(data.Nodes, data.Edges)

		// Return result via stdout
		if err := json.NewEncoder(os.Stdout).Encode(communities); err != nil {
			os.Exit(1)
		}
	}
}

// runLouvainFast represents the highly efficient Go implementation
func runLouvainFast(nodes []Node, edges []Edge) map[string]int {
	// ... dense memory graph algorithm ...
	return map[string]int{"nodeA": 1, "nodeB": 1}
}
```

### 2. TypeScript Orchestrator (The Bridge)
```typescript
// engine/src/graph/compile.ts
import { spawn } from 'child_process';

export async function detectCommunities(nodes: any[], edges: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
        // Spawn the Go native CLI sidecar
        const goProcess = spawn('./swarmvault-native', ['detect-communities']);

        let output = '';

        goProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        goProcess.stderr.on('data', (data) => {
            console.error(`Go Error: ${data}`);
        });

        goProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Go process exited with code ${code}`));
            }
            // Parse the result back from stdout
            resolve(JSON.parse(output));
        });

        // Pass the heavy graph data via stdin, completely bypassing V8 GC spikes
        const payload = JSON.stringify({ nodes, edges });
        goProcess.stdin.write(payload);
        goProcess.stdin.end();
    });
}
```

---

## Updated Phased Roadmap

To achieve the standalone Go CLI incrementally, the recommended path is:

1.  **Phase 1 (Setup & CLI Bridge):** Establish the Go CLI framework (`cmd/swarmvault-native`). Set up the IPC/subprocess bridge utility in the TypeScript orchestrator to handle standard stdin/stdout JSON passing.
2.  **Phase 2 (High-Impact Algorithmic Port):** Port heavy graph operations (community detection, Louvain) first to relieve immediate memory pressure in Node.js.
3.  **Phase 3 (I/O Porting):** Port document parsing, chunking, and file ingestion utilizing Go’s native concurrency (Goroutines) for massive parallel throughput.
4.  **Phase 4 (Final Handover):** Port the remaining orchestrator shell logic to Go. Fully deprecate the Node.js/TypeScript runtime and compile the final standalone Go binary for distribution.
