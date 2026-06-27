#!/usr/bin/env node
/**
 * Performance regression lane for SwarmVault.
 *
 * Measures a small set of tight operations against a deterministic in-memory
 * workload, compares each median against an absolute budget recorded in
 * `scripts/perf-budgets.json`, and fails the build if any median exceeds it.
 *
 * Budgets are hand-maintained and sized with generous headroom over both
 * local and CI measurements so environment noise never breaks the build —
 * only real order-of-magnitude regressions do. Update budgets deliberately
 * in a commit whose message explains the reason.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const budgetsPath = path.join(scriptDir, "perf-budgets.json");

function parseArgs(argv) {
  const args = { json: false };
  for (const token of argv) {
    if (token === "--json") args.json = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

async function loadBudgets() {
  const raw = await fs.readFile(budgetsPath, "utf8");
  return JSON.parse(raw);
}

async function time(label, fn, iterations = 1) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    label,
    iterations,
    medianMs: samples[Math.floor(samples.length / 2)],
    minMs: samples[0],
    maxMs: samples[samples.length - 1]
  };
}

async function importEngine() {
  const pkgPath = path.join(repoRoot, "packages", "engine", "dist", "index.js");
  try {
    await fs.access(pkgPath);
  } catch {
    throw new Error(
      `engine dist not built at ${path.relative(repoRoot, pkgPath)}. Run \`pnpm build\` before the perf lane.`
    );
  }
  return import(pkgPath);
}

async function runBenchmarks() {
  const engine = await importEngine();
  const measurements = [];

  const now = Date.now();
  const lastConfirmed = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
  const config = engine.resolveDecayConfig({});
  measurements.push(
    await time(
      "computeDecayScore:10k",
      () => {
        let acc = 0;
        for (let i = 0; i < 10_000; i += 1) {
          acc += engine.computeDecayScore(lastConfirmed, "first_party", config, new Date(now));
        }
        if (acc < 0) throw new Error("impossible");
      },
      5
    )
  );

  measurements.push(
    await time(
      "resolveLargeRepoDefaults:10k",
      () => {
        for (let i = 0; i < 10_000; i += 1) {
          engine.resolveLargeRepoDefaults({ nodeCount: 5000 + (i % 1000), totalCommunities: 40 });
        }
      },
      2
    )
  );

  const redactor = engine.buildRedactor(engine.DEFAULT_REDACTION_PATTERNS, "[REDACTED]");
  const proseChunk = "The quick brown fox jumps over the lazy dog. ".repeat(400);
  measurements.push(
    await time(
      "redact:20KB-prose",
      () => {
        const result = redactor.redact(proseChunk);
        if (!result || typeof result.text !== "string") throw new Error("redactor returned no text");
      },
      20
    )
  );

  return measurements;
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const measurements = await runBenchmarks();
  const budgets = await loadBudgets();
  const report = measurements.map((measurement) => {
    const budget = budgets[measurement.label];
    const limitMs = budget?.maxMedianMs;
    const regressed = typeof limitMs === "number" && measurement.medianMs > limitMs;
    const unbudgeted = limitMs === undefined;
    return { ...measurement, limitMs: limitMs ?? null, regressed, unbudgeted };
  });

  if (args.json) {
    console.log(JSON.stringify({ report }, null, 2));
  } else {
    for (const entry of report) {
      const budgetLabel = entry.limitMs === null ? "no-budget" : `≤${formatMs(entry.limitMs)}`;
      const verdict = entry.regressed ? "REGRESSED" : entry.unbudgeted ? "UNBUDGETED" : "ok";
      console.log(
        `[perf] ${entry.label}: median=${formatMs(entry.medianMs)} min=${formatMs(entry.minMs)} max=${formatMs(entry.maxMs)} budget=${budgetLabel} ${verdict}`
      );
    }
  }

  const regressed = report.filter((entry) => entry.regressed);
  if (regressed.length > 0) {
    const lines = regressed.map(
      (entry) => `  ${entry.label}: ${formatMs(entry.medianMs)} > ${formatMs(entry.limitMs ?? 0)}`
    );
    console.error(`[perf] budget exceeded for ${regressed.length} metric(s):\n${lines.join("\n")}`);
    console.error(
      "[perf] update scripts/perf-budgets.json after confirming the new number is intentional, with a commit message explaining why."
    );
    process.exit(1);
  }

  const unbudgeted = report.filter((entry) => entry.unbudgeted);
  if (unbudgeted.length > 0) {
    console.warn(`[perf] ${unbudgeted.length} metric(s) have no budget in scripts/perf-budgets.json.`);
  }
}

await main();
