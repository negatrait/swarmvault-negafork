import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runGoSidecar, runGoSidecarSync } from "./subprocess.js";

export function slugify(value: string): string {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync("utils", { action: "slugify", args: { value } }) as string;
  }
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

export function sha256(value: string | Uint8Array): string {
  const stringValue = typeof value === "string" ? value : new TextDecoder().decode(value);
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync("utils", { action: "sha256", args: { value: stringValue } }) as string;
  }
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function ensureDir(dirPath: string): Promise<void> {
  if (process.env.USE_GO_PORT === "true") {
    await runGoSidecar("utils", { action: "ensureDir", args: { dirPath } });
    return;
  }
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecar("utils", { action: "fileExists", args: { filePath } }) as Promise<boolean>;
  }
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecar("utils", { action: "readJsonFile", args: { filePath } }) as Promise<T | null>;
  }
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON file ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  if (process.env.USE_GO_PORT === "true") {
    await runGoSidecar("utils", { action: "writeJsonFile", args: { filePath, value } });
    return;
  }
  await ensureDir(path.dirname(filePath));
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function appendJsonLine(filePath: string, value: unknown): Promise<void> {
  if (process.env.USE_GO_PORT === "true") {
    await runGoSidecar("utils", { action: "appendJsonLine", args: { filePath, value } });
    return;
  }
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export async function writeFileIfChanged(filePath: string, content: string): Promise<boolean> {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecar("utils", { action: "writeFileIfChanged", args: { filePath, content } }) as Promise<boolean>;
  }
  await ensureDir(path.dirname(filePath));
  if (await fileExists(filePath)) {
    const existing = await fs.readFile(filePath, "utf8");
    if (existing === content) {
      return false;
    }
  }
  await fs.writeFile(filePath, content, "utf8");
  return true;
}

export function toPosix(value: string): string {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync("utils", { action: "toPosix", args: { value } }) as string;
  }
  return value.split(path.sep).join(path.posix.sep);
}

export function isPathWithin(rootDir: string, candidate: string): boolean {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync("utils", { action: "isPathWithin", args: { rootDir, candidate } }) as boolean;
  }
  const normalizedRoot = path.resolve(rootDir);
  const normalizedCandidate = path.resolve(candidate);
  if (normalizedCandidate === normalizedRoot) {
    return true;
  }
  const withSep = normalizedRoot.endsWith(path.sep) ? normalizedRoot : normalizedRoot + path.sep;
  return normalizedCandidate.startsWith(withSep);
}

export function firstSentences(value: string, count = 3): string {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync("utils", { action: "firstSentences", args: { value, count } }) as string;
  }
  const sentences = value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  return sentences.slice(0, count).join(" ").trim();
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const itemKey = key(item);
    if (seen.has(itemKey)) {
      continue;
    }
    seen.add(itemKey);
    result.push(item);
  }

  return result;
}

export function extractJson(text: string): string {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync("utils", { action: "extractJson", args: { text } }) as string;
  }
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const start = text.indexOf("{");
  if (start !== -1) {
    let end = text.lastIndexOf("}");
    while (end > start) {
      const candidate = text.slice(start, end + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        end = text.lastIndexOf("}", end - 1);
      }
    }
  }

  throw new Error("Could not locate JSON object in provider response.");
}

export function normalizeWhitespace(value: string): string {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync("utils", { action: "normalizeWhitespace", args: { value } }) as string;
  }
  return value.replace(/\s+/g, " ").trim();
}

export function safeFrontmatter<T extends Record<string, unknown>>(value: T): T {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync("utils", { action: "safeFrontmatter", args: { value } }) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function truncate(value: string, maxLength: number): string {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecarSync("utils", { action: "truncate", args: { value, maxLength } }) as string;
  }
  if (value.length <= maxLength) {
    return value;
  }
  if (maxLength < 4) {
    return value.slice(0, maxLength);
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

export async function listFilesRecursive(rootDir: string): Promise<string[]> {
  if (process.env.USE_GO_PORT === "true") {
    return runGoSidecar("utils", { action: "listFilesRecursive", args: { rootDir } }) as Promise<string[]>;
  }
  const entries = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}
