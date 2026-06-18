import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function runGoSidecar(subcommand: string, inputPayload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // Resolve absolute path to avoid pnpm workspace cwd confusion
    // import.meta.url points to dist/subprocess.js when built
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // In dev it's in packages/engine/src/subprocess.ts -> ../../../swarmvault-native
    // In prod it's in packages/engine/dist/subprocess.js -> ../../../swarmvault-native
    const isWin = process.platform === "win32";
    const binaryName = isWin ? "swarmvault-native.exe" : "swarmvault-native";
    const binaryPath = path.resolve(__dirname, "..", "..", "..", binaryName);

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
