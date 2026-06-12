import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileVault, ingestDirectory, initVault, listGraphCallers } from "../src/index.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "swarmvault-graph-callers-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("graph callers", () => {
  it("lists callers with file:line call-site evidence", async () => {
    const rootDir = await createTempWorkspace();
    await initVault(rootDir);
    const repoDir = path.join(rootDir, "repo");
    await fs.mkdir(repoDir, { recursive: true });
    await fs.writeFile(
      path.join(repoDir, "billing.ts"),
      ["export function chargeCustomer(amount: number): number {", "  return amount * 100;", "}", ""].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(repoDir, "checkout.ts"),
      [
        "import { chargeCustomer } from './billing';",
        "",
        "export function completeCheckout(total: number): number {",
        "  const cents = chargeCustomer(total);",
        "  return cents;",
        "}",
        "",
        "export function retryCheckout(total: number): number {",
        "  return chargeCustomer(total);",
        "}",
        ""
      ].join("\n"),
      "utf8"
    );
    await ingestDirectory(rootDir, repoDir, {});
    await compileVault(rootDir);

    const result = await listGraphCallers(rootDir, "chargeCustomer");
    expect(result.targetLabel).toBe("chargeCustomer");
    expect(result.callers.length).toBeGreaterThanOrEqual(2);

    const callerLabels = result.callers.map((caller) => caller.callerLabel);
    expect(callerLabels).toEqual(expect.arrayContaining(["completeCheckout", "retryCheckout"]));

    const complete = result.callers.find((caller) => caller.callerLabel === "completeCheckout");
    expect(complete?.filePath).toContain("checkout.ts");
    expect(complete?.callSites.map((site) => site.line)).toContain(4);
    expect(result.summary).toContain("checkout.ts:4");
    expect(result.summary).toMatch(/chargeCustomer\(total\)/);
  });

  it("attributes call sites to the correct caller within one file", async () => {
    const rootDir = await createTempWorkspace();
    await initVault(rootDir);
    const repoDir = path.join(rootDir, "repo");
    await fs.mkdir(repoDir, { recursive: true });
    await fs.writeFile(
      path.join(repoDir, "billing.ts"),
      "export function chargeCustomer(amount: number): number {\n  return amount * 100;\n}\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(repoDir, "checkout.ts"),
      [
        "import { chargeCustomer } from './billing';",
        "",
        "export function completeCheckout(total: number): number {",
        "  return chargeCustomer(total);",
        "}",
        "",
        "export function retryCheckout(total: number): number {",
        "  return chargeCustomer(total) + 1;",
        "}",
        ""
      ].join("\n"),
      "utf8"
    );
    await ingestDirectory(rootDir, repoDir, {});
    await compileVault(rootDir);

    const result = await listGraphCallers(rootDir, "chargeCustomer");
    const complete = result.callers.find((caller) => caller.callerLabel === "completeCheckout");
    const retry = result.callers.find((caller) => caller.callerLabel === "retryCheckout");
    // Each caller reports only the call sites inside its own declaration range.
    expect(complete?.callSites.map((site) => site.line)).toEqual([4]);
    expect(retry?.callSites.map((site) => site.line)).toEqual([8]);
  });

  it("reports symbols with no callers", async () => {
    const rootDir = await createTempWorkspace();
    await initVault(rootDir);
    const repoDir = path.join(rootDir, "repo");
    await fs.mkdir(repoDir, { recursive: true });
    await fs.writeFile(path.join(repoDir, "solo.ts"), "export function unusedHelper(): number {\n  return 1;\n}\n", "utf8");
    await ingestDirectory(rootDir, repoDir, {});
    await compileVault(rootDir);

    const result = await listGraphCallers(rootDir, "unusedHelper");
    expect(result.callers).toHaveLength(0);
    expect(result.summary).toContain("No incoming call edges");
  });

  it("throws for unresolvable targets", async () => {
    const rootDir = await createTempWorkspace();
    await initVault(rootDir);
    const repoDir = path.join(rootDir, "repo");
    await fs.mkdir(repoDir, { recursive: true });
    await fs.writeFile(path.join(repoDir, "a.ts"), "export const x = 1;\n", "utf8");
    await ingestDirectory(rootDir, repoDir, {});
    await compileVault(rootDir);

    await expect(listGraphCallers(rootDir, "definitelyNotASymbol")).rejects.toThrow(/Could not resolve/);
  });
});
