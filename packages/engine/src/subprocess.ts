import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// Avoid dual CJS/ESM target __dirname issues
function getDirname() {
  try {
    return new URL(".", import.meta.url).pathname;
  } catch (_e) {
    return process.cwd();
  }
}

export async function runGoSidecar<T = unknown>(subcommand: string, inputPayload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    // Resolve absolute path to avoid pnpm workspace cwd confusion
    const isWin = process.platform === "win32";
    const binaryName = isWin ? "swarmvault-native.exe" : "swarmvault-native";
    const binaryPath = (() => {
      // Find the binary by looking up from either the source or compiled file, or from cwd
      let current = typeof __dirname !== "undefined" ? __dirname : getDirname();
      while (current !== "/" && current !== path.parse(current).root) {
        if (fs.existsSync(path.join(current, "bin", binaryName))) {
          return path.join(current, "bin", binaryName);
        }
        if (fs.existsSync(path.join(current, binaryName))) {
          return path.join(current, binaryName);
        }
        current = path.dirname(current);
      }
      current = process.cwd();
      while (current !== "/" && current !== path.parse(current).root) {
        if (fs.existsSync(path.join(current, "bin", binaryName))) {
          return path.join(current, "bin", binaryName);
        }
        if (fs.existsSync(path.join(current, binaryName))) {
          return path.join(current, binaryName);
        }
        current = path.dirname(current);
      }

      const paths = (process.env.PATH || "").split(path.delimiter);
      for (const p of paths) {
        if (p && fs.existsSync(path.join(p, binaryName))) return path.join(p, binaryName);
      }
      const homeBin = path.join(process.env.HOME || "", ".swarmvault-negafork", "bin", binaryName);
      if (fs.existsSync(homeBin)) return homeBin;

      return path.join(process.cwd(), binaryName);
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
      } catch (_e) {
        reject(new Error(`Failed to parse Go sidecar output: ${_e}\nOutput was: ${stdout}`));
      }
    });

    // Pass the payload via stdin
    child.stdin.write(JSON.stringify(inputPayload));
    child.stdin.end();
  });
}

import { spawnSync } from "node:child_process";

export function runGoSidecarSync<T = unknown>(subcommand: string, inputPayload: unknown): T {
  const isWin = process.platform === "win32";
  const binaryName = isWin ? "swarmvault-native.exe" : "swarmvault-native";
  const binaryPath = (() => {
    let current = typeof __dirname !== "undefined" ? __dirname : getDirname();
    while (current !== "/" && current !== path.parse(current).root) {
      if (fs.existsSync(path.join(current, "bin", binaryName))) {
        return path.join(current, "bin", binaryName);
      }
      if (fs.existsSync(path.join(current, binaryName))) {
        return path.join(current, binaryName);
      }
      current = path.dirname(current);
    }
    current = process.cwd();
    while (current !== "/" && current !== path.parse(current).root) {
      if (fs.existsSync(path.join(current, "bin", binaryName))) {
        return path.join(current, "bin", binaryName);
      }
      if (fs.existsSync(path.join(current, binaryName))) {
        return path.join(current, binaryName);
      }
      current = path.dirname(current);
    }

    const paths = (process.env.PATH || "").split(path.delimiter);
    for (const p of paths) {
      if (p && fs.existsSync(path.join(p, binaryName))) return path.join(p, binaryName);
    }
    const homeBin = path.join(process.env.HOME || "", ".swarmvault-negafork", "bin", binaryName);
    if (fs.existsSync(homeBin)) return homeBin;

    return path.join(process.cwd(), binaryName);
  })();

  const child = spawnSync(binaryPath, [subcommand], {
    input: JSON.stringify(inputPayload),
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024
  });

  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(`Go sidecar failed (code ${child.status}): ${child.stderr}`);
  }
  try {
    return JSON.parse(child.stdout);
  } catch (_e) {
    throw new Error(`Failed to parse Go sidecar output: ${_e}\nOutput was: ${child.stdout}`);
  }
}
