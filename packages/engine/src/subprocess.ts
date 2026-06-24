import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function runGoSidecar<T = unknown>(subcommand: string, inputPayload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    // Resolve absolute path to avoid pnpm workspace cwd confusion
    // import.meta.url points to dist/subprocess.js when built
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // In dev it's in packages/engine/src/subprocess.ts -> ../../../swarmvault-native
    // In prod it's in packages/engine/dist/subprocess.js -> ../../../swarmvault-native
    const isWin = process.platform === "win32";
    const binaryName = isWin ? "swarmvault-native.exe" : "swarmvault-native";
    const binaryPath = (() => {
      // Check multiple locations for the binary
      const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
      const binDir = path.resolve(workspaceRoot, "bin");

      const candidates = [
        path.join(binDir, binaryName),
        path.join(workspaceRoot, binaryName),
        path.join(process.env.HOME || "", ".swarmvault-negafork", "bin", binaryName)
      ];

      const paths = (process.env.PATH || "").split(path.delimiter);
      for (const p of paths) {
        if (p) candidates.push(path.join(p, binaryName));
      }

      for (const c of candidates) {
        if (fs.existsSync(c)) {
          return c;
        }
      }

      return path.join(workspaceRoot, binaryName);
    })();

    // Explicitly define stdio routing
    const child = spawn(binaryPath, [subcommand], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    // Accumulate chunks (vital for large JSON returns)
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

    // Pass the payload via stdin
    child.stdin.write(JSON.stringify(inputPayload));
    child.stdin.end();
  });
}

import { spawnSync } from "node:child_process";

export function runGoSidecarSync<T = unknown>(subcommand: string, inputPayload: unknown): T {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const isWin = process.platform === "win32";
  const binaryName = isWin ? "swarmvault-native.exe" : "swarmvault-native";
  const binaryPath = (() => {
    // Check multiple locations for the binary
    const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
    const binDir = path.resolve(workspaceRoot, "bin");

    const candidates = [
      path.join(binDir, binaryName),
      path.join(workspaceRoot, binaryName),
      path.join(process.env.HOME || "", ".swarmvault-negafork", "bin", binaryName)
    ];

    const paths = (process.env.PATH || "").split(path.delimiter);
    for (const p of paths) {
      if (p) candidates.push(path.join(p, binaryName));
    }

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }

    return path.join(workspaceRoot, binaryName);
  })();

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
