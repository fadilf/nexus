import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { ENTOURAGE_DIR } from "./config";

const execFileAsync = promisify(execFile);

const SNAPSHOTS_DIR = "snapshots";

function snapshotDir(workspaceDir: string): string {
  return path.join(workspaceDir, ENTOURAGE_DIR, SNAPSHOTS_DIR);
}

function gitEnv(workspaceDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_DIR: snapshotDir(workspaceDir),
    GIT_WORK_TREE: workspaceDir,
  };
}

/**
 * Initialize the shadow bare git repo if it doesn't exist.
 * Returns true if ready, false if git isn't available.
 */
export async function initSnapshotRepo(workspaceDir: string): Promise<boolean> {
  const dir = snapshotDir(workspaceDir);
  try {
    await fs.access(path.join(dir, "HEAD"));
    return true; // Already initialized
  } catch {
    // Not initialized yet
  }
  try {
    await fs.mkdir(dir, { recursive: true });
    await execFileAsync("git", ["init", "--bare", dir]);
    // Safety net: add default excludes in case workspace has no .gitignore
    const excludeDir = path.join(dir, "info");
    await fs.mkdir(excludeDir, { recursive: true });
    await fs.writeFile(
      path.join(excludeDir, "exclude"),
      "node_modules/\n.env\n.env.*\n*.log\n.DS_Store\n"
    );
    return true;
  } catch {
    return false; // git not available or init failed
  }
}

/**
 * Capture the current workspace state as a git tree object.
 * Returns the tree hash, or null if capture fails.
 */
export async function captureSnapshot(workspaceDir: string): Promise<string | null> {
  try {
    const ready = await initSnapshotRepo(workspaceDir);
    if (!ready) return null;

    const env = gitEnv(workspaceDir);

    // Stage all files (respects .gitignore)
    await execFileAsync("git", ["add", "-A"], { env, cwd: workspaceDir });

    // Write tree object and return hash
    const { stdout } = await execFileAsync("git", ["write-tree"], { env, cwd: workspaceDir });
    return stdout.trim() || null;
  } catch {
    return null; // Fail silently — snapshot is best-effort
  }
}

/**
 * Restore workspace files to match a previously captured tree hash.
 * Only modifies files that differ. Removes files that didn't exist at snapshot time.
 */
export async function restoreSnapshot(workspaceDir: string, treeHash: string): Promise<boolean> {
  try {
    const ready = await initSnapshotRepo(workspaceDir);
    if (!ready) return false;

    const env = gitEnv(workspaceDir);

    // Get current tree for diffing
    await execFileAsync("git", ["add", "-A"], { env, cwd: workspaceDir });
    const { stdout: currentTree } = await execFileAsync("git", ["write-tree"], { env, cwd: workspaceDir });

    if (currentTree.trim() === treeHash) return true; // Already at target state

    // Find files to delete (present now but not in snapshot)
    const { stdout: diffOutput } = await execFileAsync(
      "git",
      ["diff-tree", "-r", "--no-commit-id", "--diff-filter=A", "--name-only", treeHash, currentTree.trim()],
      { env, cwd: workspaceDir }
    );
    const filesToDelete = diffOutput.trim().split("\n").filter(Boolean);

    // Restore files from snapshot tree
    await execFileAsync("git", ["read-tree", treeHash], { env, cwd: workspaceDir });
    await execFileAsync(
      "git",
      ["checkout-index", "-a", "-f"],
      { env, cwd: workspaceDir }
    );

    // Delete files that were added after the snapshot
    for (const file of filesToDelete) {
      const filePath = path.join(workspaceDir, file);
      await fs.unlink(filePath).catch(() => {});
      // Clean up empty parent directories
      let dir = path.dirname(filePath);
      while (dir !== workspaceDir) {
        try {
          await fs.rmdir(dir); // Only succeeds if empty
          dir = path.dirname(dir);
        } catch {
          break;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a tree hash exists in the snapshot repo.
 */
export async function hasSnapshot(workspaceDir: string, treeHash: string): Promise<boolean> {
  try {
    const env = gitEnv(workspaceDir);
    await execFileAsync("git", ["cat-file", "-t", treeHash], { env, cwd: workspaceDir });
    return true;
  } catch {
    return false;
  }
}
