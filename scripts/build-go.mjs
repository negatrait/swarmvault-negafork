import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

// Check if go compiler is present
const goCheck = spawnSync("go", ["version"], { shell: true });
if (goCheck.status !== 0) {
  console.log("Go compiler not found in the environment. Skipping Go build.");
  process.exit(0);
}

console.log("Go compiler found. Compiling swarmvault-native sidecar...");

// Ensure bin directory exists
const binDir = path.join(workspaceRoot, "bin");
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const isWin = process.platform === "win32";
const binaryName = isWin ? "swarmvault-native.exe" : "swarmvault-native";
const outputPath = path.join(binDir, binaryName);

const build = spawnSync(
  "go",
  ["build", "-o", outputPath, "./cmd/swarmvault-native"],
  {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, CGO_ENABLED: "0" }
  }
);

if (build.status !== 0) {
  console.error("Failed to build Go native sidecar.");
  process.exit(1);
}

console.log(`Go native sidecar built successfully at: ${outputPath}`);
