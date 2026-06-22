import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadVaultConfig } from "./config.js";
import { runGoSidecar } from "./subprocess.js";

const execFileAsync = promisify(execFile);

async function git(rootDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: rootDir });
  return stdout.trim();
}

async function isGitRepo(rootDir: string): Promise<boolean> {
  try {
    await git(rootDir, "rev-parse", "--is-inside-work-tree");
    return true;
  } catch {
    return false;
  }
}

export async function autoCommitWikiChanges(
  rootDir: string,
  operation: string,
  detail?: string,
  options?: { force?: boolean }
): Promise<string | null> {
  const { config, paths } = await loadVaultConfig(rootDir);

  if (process.env.USE_GO_PORT === "true") {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: Any used during TS to Go bridging
      const result = await runGoSidecar<any>("auto-commit", {
        rootDir,
        operation,
        detail,
        config: {
          autoCommit: config.autoCommit,
          wikiDir: paths.wikiDir,
          stateDir: paths.stateDir
        },
        options: options || {}
      });
      return result.message;
    } catch (error) {
      console.warn(`Go sidecar failed, falling back to TS implementation: ${error}`);
      // Fallback
    }
  }

  if (!options?.force && !config.autoCommit) {
    return null;
  }

  if (!(await isGitRepo(rootDir))) {
    return null;
  }

  const wikiRelative = paths.wikiDir.replace(`${rootDir}/`, "");
  const stateRelative = paths.stateDir.replace(`${rootDir}/`, "");

  await git(rootDir, "add", wikiRelative, stateRelative).catch(() => {});

  const status = await git(rootDir, "diff", "--cached", "--stat");
  if (!status) {
    return null;
  }

  const message = detail ? `vault ${operation}: ${detail}` : `vault ${operation}`;
  await git(rootDir, "commit", "-m", message);
  return message;
}
