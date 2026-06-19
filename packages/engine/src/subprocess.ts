import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveBinaryPath(dirname: string, binaryName: string): string {
  // Typical dev resolution (from src or dist)
  let candidate = path.resolve(dirname, "..", "..", "..", "bin", binaryName);
  if (fs.existsSync(candidate)) return candidate;

  candidate = path.resolve(dirname, "..", "..", "bin", binaryName);
  if (fs.existsSync(candidate)) return candidate;

  candidate = path.resolve(dirname, "..", "..", "..", "..", "bin", binaryName);
  if (fs.existsSync(candidate)) return candidate;

  // Also try resolving it right next to our tree for global installs
  candidate = path.resolve(dirname, "..", "..", "..", binaryName);
  if (fs.existsSync(candidate)) return candidate;

  return candidate;
}

// biome-ignore lint/suspicious/noExplicitAny: This is a generic boundary wrapper for all payloads
export async function runGoSidecar(subcommand: string, inputPayload: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const isWin = process.platform === "win32";
    const binaryName = isWin ? "swarmvault-native.exe" : "swarmvault-native";
    const binaryPath = resolveBinaryPath(__dirname, binaryName);

    const child = spawn(binaryPath, [subcommand], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Go sidecar failed (code ${code}): ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`Failed to parse Go sidecar output: ${e}\nOutput was: ${stdout}`));
      }
    });

    child.stdin.write(JSON.stringify(inputPayload));
    child.stdin.end();
  });
}

import { spawnSync } from "node:child_process";

// biome-ignore lint/suspicious/noExplicitAny: This is a generic boundary wrapper for all payloads
export function runGoSidecarSync(subcommand: string, inputPayload: unknown): any {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const isWin = process.platform === "win32";
  const binaryName = isWin ? "swarmvault-native.exe" : "swarmvault-native";
  const binaryPath = resolveBinaryPath(__dirname, binaryName);

  const child = spawnSync(binaryPath, [subcommand], {
    input: JSON.stringify(inputPayload),
    encoding: "utf-8"
  });

  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(`Go sidecar failed (code ${child.status}): ${child.stderr}`);
  }
  try {
    return JSON.parse(child.stdout);
  } catch (e) {
    throw new Error(`Failed to parse Go sidecar output: ${e}\nOutput was: ${child.stdout}`);
  }
}
