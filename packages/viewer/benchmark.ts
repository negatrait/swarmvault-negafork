import { embeddedGraphQuery, type ViewerGraphArtifact } from "./src/lib.ts";

// Generate a large mock graph
const nodeCount = 50000;
const hyperedgeCount = 50000;
const nodesPerHyperedge = 20;

console.log(`Generating mock graph with ${nodeCount} nodes and ${hyperedgeCount} hyperedges...`);

const nodes = Array.from({ length: nodeCount }, (_, i) => ({
  id: `node-${i}`,
  label: `Node ${i}`,
  communityId: `comm-${i % 10}`,
  type: "concept"
}));

const hyperedges = Array.from({ length: hyperedgeCount }, (_, i) => ({
  id: `hyperedge-${i}`,
  label: `Hyperedge ${i}`,
  name: `Hyperedge ${i}`,
  nodeIds: Array.from({ length: nodesPerHyperedge }, () => `node-${Math.floor(Math.random() * nodeCount)}`),
  confidence: 1,
  why: "",
  relation: ""
}));

const edges = Array.from({ length: nodeCount * 2 }, (_, i) => ({
  id: `edge-${i}`,
  source: `node-${Math.floor(Math.random() * nodeCount)}`,
  target: `node-${Math.floor(Math.random() * nodeCount)}`,
  relation: "related",
  confidence: 1
}));

const mockGraph = {
  nodes,
  edges,
  hyperedges,
  pages: [],
  meta: {
    lastUpdated: new Date().toISOString()
  }
};

const mockSearchResults: Array<Record<string, never>> = [];
const question = "test query";

console.log("Running optimized benchmark...");

const iterations = 10;
const times: number[] = [];

// Warmup
embeddedGraphQuery(mockGraph as unknown as ViewerGraphArtifact, question, mockSearchResults, { budget: 50 });

for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  embeddedGraphQuery(mockGraph as unknown as ViewerGraphArtifact, question, mockSearchResults, { budget: 50 });
  const end = performance.now();
  times.push(end - start);
}

const avgTime = times.reduce((a, b) => a + b, 0) / iterations;
const minTime = Math.min(...times);
const maxTime = Math.max(...times);

console.log(`\nBenchmark Results (${iterations} iterations):`);
console.log(`Average: ${avgTime.toFixed(2)} ms`);
console.log(`Min: ${minTime.toFixed(2)} ms`);
console.log(`Max: ${maxTime.toFixed(2)} ms`);
