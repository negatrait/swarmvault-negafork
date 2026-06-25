// TODO: Port graph querying, traversal, or compilation to Go under internal/graph. Maintain 1:1 structural parity and add differential testing against TS output.
import fs from "node:fs/promises";
import path from "node:path";
import { loadVaultConfig } from "./config.js";
import { resolveCoreNode } from "./graph-query-core.js";
import { listManifests } from "./ingest.js";
import type { GraphArtifact, GraphNode, SourceManifest } from "./types.js";
import { readJsonFile } from "./utils.js";

export interface GraphCallSite {
  line: number;
  text: string;
}

export interface GraphCallerEntry {
  callerId: string;
  callerLabel: string;
  callerKind?: string;
  filePath: string;
  repoRelativePath?: string;
  callSites: GraphCallSite[];
}

export interface GraphCallersResult {
  target: string;
  targetId: string;
  targetLabel: string;
  callers: GraphCallerEntry[];
  summary: string;
}

const MAX_CALL_SITES_PER_FILE = 8;

function callSitePattern(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word-boundary match for the symbol name; optional call parens keeps
  // languages without call syntax (references, decorators) included.
  return new RegExp(`(?:^|[^\\w$])${escaped}\\b`);
}

async function readCallerSource(manifest: SourceManifest, rootDir: string): Promise<string | null> {
  const candidates = [manifest.originalPath, manifest.storedPath ? path.resolve(rootDir, manifest.storedPath) : undefined];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return await fs.readFile(candidate, "utf8");
    } catch {
      // Try the next location.
    }
  }
  return null;
}

function findCallSites(
  source: string,
  targetLabel: string,
  callerLabel: string,
  range?: { startLine?: number; endLine?: number }
): GraphCallSite[] {
  const pattern = callSitePattern(targetLabel);
  const definitionPattern = new RegExp(
    `(?:function|def|fn|func|const|let|var|class|interface|type)\\s+${targetLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
  );
  const sites: GraphCallSite[] = [];
  const lines = source.split(/\r?\n/);
  // When the caller symbol carries a declaration line range, scan only that
  // range so call sites are attributed to the right caller in the file.
  const firstIndex = range?.startLine ? Math.max(0, range.startLine - 1) : 0;
  const lastIndex = range?.endLine ? Math.min(lines.length - 1, range.endLine - 1) : lines.length - 1;
  for (let index = firstIndex; index <= lastIndex && sites.length < MAX_CALL_SITES_PER_FILE; index += 1) {
    const text = lines[index];
    if (!pattern.test(text)) continue;
    // Skip the target's own definition line and import lines — callers want use sites.
    if (definitionPattern.test(text)) continue;
    if (/^\s*(?:import|from|export\s+\{|use\s|require\()/.test(text) && !text.includes(`${callerLabel}(`)) continue;
    sites.push({ line: index + 1, text: text.trim().slice(0, 160) });
  }
  return sites;
}

/**
 * List the callers of a symbol with file:line call-site evidence.
 *
 * The graph's `calls` edges identify exactly which symbols (and therefore
 * which files) call the target; only those files are scanned for the
 * call-site lines, so the output stays small and grounded.
 */
export async function listGraphCallers(rootDir: string, target: string): Promise<GraphCallersResult> {
  const { paths } = await loadVaultConfig(rootDir);
  const graph = await readJsonFile<GraphArtifact>(paths.graphPath);
  if (!graph) {
    throw new Error("No compiled graph found. Run `swarmvault compile` first.");
  }

  const node = resolveCoreNode(graph, target) as GraphNode | undefined;
  if (!node) {
    throw new Error(`Could not resolve graph target: ${target}`);
  }

  const callerIds = graph.edges.filter((edge) => edge.relation === "calls" && edge.target === node.id).map((edge) => edge.source);
  const nodeById = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));
  const manifests = await listManifests(rootDir);
  const manifestBySourceId = new Map(manifests.map((manifest) => [manifest.sourceId, manifest]));

  const callers: GraphCallerEntry[] = [];
  const scannedSources = new Map<string, string | null>();

  for (const callerId of [...new Set(callerIds)]) {
    const caller = nodeById.get(callerId);
    if (!caller) continue;
    const sourceId = caller.sourceIds[0];
    const manifest = sourceId ? manifestBySourceId.get(sourceId) : undefined;
    if (!manifest) continue;

    if (!scannedSources.has(manifest.sourceId)) {
      scannedSources.set(manifest.sourceId, await readCallerSource(manifest, rootDir));
    }
    const source = scannedSources.get(manifest.sourceId);
    const filePath = manifest.repoRelativePath ?? manifest.originalPath ?? manifest.storedPath;

    callers.push({
      callerId,
      callerLabel: caller.label,
      callerKind: caller.symbolKind,
      filePath: filePath ?? "unknown",
      repoRelativePath: manifest.repoRelativePath,
      callSites: source ? findCallSites(source, node.label, caller.label, { startLine: caller.startLine, endLine: caller.endLine }) : []
    });
  }

  callers.sort((left, right) => left.filePath.localeCompare(right.filePath) || left.callerLabel.localeCompare(right.callerLabel));

  const lines = [
    `Callers of ${node.label} (${callers.length} caller${callers.length === 1 ? "" : "s"} from graph call edges):`,
    ...callers.flatMap((caller) => {
      const head = `- ${caller.callerLabel}${caller.callerKind ? ` (${caller.callerKind})` : ""} — ${caller.filePath}`;
      const sites = caller.callSites.map((site) => `    ${caller.filePath}:${site.line}  ${site.text}`);
      return sites.length > 0 ? [head, ...sites] : [head, "    (call site line not found in source — symbol-level edge only)"];
    })
  ];
  if (callers.length === 0) {
    lines.push("No incoming call edges. The symbol may be exported for external use, dynamically invoked, or unused.");
  }

  return {
    target,
    targetId: node.id,
    targetLabel: node.label,
    callers,
    summary: lines.join("\n")
  };
}
