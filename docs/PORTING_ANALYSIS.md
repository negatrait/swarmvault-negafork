# Porting SwarmVault: Architecture Analysis & Roadmap

## Executive Summary

This document analyzes the feasibility, strategies, and benefits of porting sections of SwarmVault to WebAssembly (WASM), Go, or Rust. The analysis is driven by the following primary goals:

1. **Shrink the Memory Footprint:** Reduce memory consumption, particularly during massive graph ingestion and compilation.
2. **Standalone Binary:** Enable compilation into a standalone CLI executable that requires zero runtime dependencies (e.g., no Node.js runtime to install).
3. **WASM Compatibility:** Maintain WebAssembly as a compile target for flexibility (e.g., running in browsers, edge workers, or securely sandboxed plugins), reconciling this with the standalone CLI priority.

## Language and Target Analysis

### 1. Rust (Highly Recommended)
Rust is perfectly positioned to address both the standalone CLI and the WASM priorities.

*   **Benefits:**
    *   **Memory Efficiency:** Zero-cost abstractions and no garbage collector (GC). Rust provides deterministic memory management, which is critical when parsing huge documents and performing graph operations.
    *   **WASM First-Class Citizen:** Rust has arguably the most mature WASM ecosystem (`wasm-bindgen`, `wasm-pack`). A core Rust library can be easily compiled to `.wasm` to be embedded in Node, Deno, or a browser viewer.
    *   **Standalone CLI:** Rust naturally compiles down to a statically linked, native binary for macOS, Linux, and Windows.
*   **Verdict:** Rust resolves the "conflicting priorities." You can build a shared core library (`swarmvault-core`), compile it as a standalone CLI (`swarmvault-cli`), and also compile it to WASM to drop into the existing TypeScript ecosystem seamlessly.

### 2. Go (Alternative for Standalone CLI)
Go excels at building standalone networking/CLI tools quickly.

*   **Benefits:**
    *   **Simplicity & Concurrency:** Go routines make parallel file ingestion and network requests (for LLM API calls) incredibly simple to write and maintain.
    *   **Standalone CLI:** Produces statically linked native binaries out of the box with zero fuss.
*   **Drawbacks:**
    *   **WASM Support:** While Go *can* compile to WASM, the resulting binaries are inherently large (often 2MB+ bare minimum) because the Go runtime and Garbage Collector must be embedded in the WASM file. Solutions like `TinyGo` exist but lack support for all standard library packages.
    *   **Memory Footprint:** Lower than Node.js, but still higher than Rust due to the GC overhead during heavy graph parsing.
*   **Verdict:** Great for a fast CLI rewrite, but poor if a lightweight WASM target is a strict priority.

### 3. WebAssembly (WASM) as a Target
WASM is a compile target, not a language.

*   **Benefits:** By moving heavy processing (like graph algorithms or AST parsing) out of JavaScript and into a WASM module, you bypass the V8 engine's garbage collection pauses and object allocation overhead. This drastically reduces the Node.js memory footprint.

---

## High-Impact Areas for Porting

If porting incrementally, these sections of the SwarmVault `@swarmvaultai/engine` will yield the highest ROI for memory footprint reduction.

### A. Graph Compilation & Algorithms (Louvain / Graphology)
SwarmVault currently relies on JavaScript implementations for graph data structures and community detection (Louvain algorithm). Loading thousands of nodes/edges as JavaScript objects balloons the V8 heap and causes garbage collection thrashing.

*   **Proposed Port:** Rust (using crates like `petgraph`).
*   **Benefit:** Rust's memory layout is contiguous and dense. A graph taking 1GB in Node.js might take 50MB in Rust.

### B. Document Ingestion, Chunking & AST Parsing
Reading large PDFs, DOCX, and processing Markdown to AST creates thousands of small transient objects.

*   **Proposed Port:** Rust / Go.
*   **Benefit:** A compiled language can use streaming parsers and memory-mapped files (mmap) to read gigabytes of data without loading the entire document into RAM.

---

## Example Snippets: Porting Graph Community Detection

This example demonstrates how porting a memory-heavy graph operation from TypeScript to Rust (compiled to WASM/CLI) would look.

### 1. Current TypeScript (Conceptual)
```typescript
// engine/src/graph/compile.ts
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

export function detectCommunities(nodes: any[], edges: any[]) {
  // Heavy memory allocation in V8 heap
  const graph = new Graph();

  for (const n of nodes) {
    graph.addNode(n.id, n);
  }
  for (const e of edges) {
    graph.addEdge(e.source, e.target);
  }

  // Algorithm runs in single-threaded JS, causing GC spikes
  const communities = louvain(graph);
  return communities;
}
```

### 2. Ported to Rust (Core Library)
```rust
// src/graph.rs
use petgraph::graph::{NodeIndex, UnGraph};
use std::collections::HashMap;
// Hypothetical louvain crate
use louvain_rs::louvain;

// Zero-cost abstractions, tightly packed in memory
pub fn detect_communities_fast(
    nodes: Vec<String>,
    edges: Vec<(String, String)>
) -> HashMap<String, usize> {
    let mut graph = UnGraph::<String, ()>::new_undirected();
    let mut indices = HashMap::new();

    for node in nodes {
        let idx = graph.add_node(node.clone());
        indices.insert(node, idx);
    }

    for (src, tgt) in edges {
        if let (Some(&s), Some(&t)) = (indices.get(&src), indices.get(&tgt)) {
            graph.add_edge(s, t, ());
        }
    }

    // Executes at near-native speed, zero GC overhead
    louvain(&graph)
}
```

### 3. Expected Outcomes

**Outcome A: Used as a WASM Module inside Node.js**
We expose the Rust function via `wasm-bindgen`. The Node.js engine delegates the heavy lifting. The V8 heap remains small, preventing out-of-memory crashes during `swarmvault compile`.

```typescript
// Typescript using the WASM port
import { detect_communities_fast } from 'swarmvault-core-wasm';

export function detectCommunities(nodes: string[], edges: [string, string][]) {
    // Data crosses the WASM boundary once. Processing is isolated.
    return detect_communities_fast(nodes, edges);
}
```

**Outcome B: Used as a Standalone CLI**
We wrap the exact same Rust core library with `clap` (a Rust CLI parser).
```bash
# Executed as a completely standalone, statically-linked binary (no Node.js required)
$ swarmvault-native compile --input ./repo
```
The CLI loads data directly from the filesystem into Rust's memory, bypassing JavaScript entirely. The memory footprint drops from 1.5GB (Node) to ~100MB (Rust native).

---

## Recommended Roadmap

To achieve both a **Standalone CLI** and **WASM** compilation, the recommended path is:

1.  **Phase 1: Hybrid Architecture (Rust -> WASM)**
    *   Create a new crate `packages/core-rs`.
    *   Rewrite the heaviest CPU/Memory bound tasks (Graph clustering, Markdown chunking) in Rust.
    *   Compile `core-rs` to WASM using `wasm-pack`.
    *   Integrate the WASM module into the existing Node.js `@swarmvaultai/engine`. This immediately solves memory bottlenecks for current users.
2.  **Phase 2: Data Layer Porting**
    *   Port SQLite/Neo4j interactions and file I/O to Rust.
3.  **Phase 3: Native CLI (Rust -> Standalone)**
    *   Wrap `core-rs` with a Rust binary target (`src/main.rs`) using `clap`.
    *   Distribute the native binary for users who want zero dependencies, while retaining the Node.js package (powered by WASM) for the JS ecosystem.
