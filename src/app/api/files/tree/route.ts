import fs from "fs/promises";
import path from "path";
import { badRequest, routeWithWorkspace, serverError } from "@/lib/api-route";

const HIDDEN_DIRS = new Set([
  "node_modules", ".git", "__pycache__", ".next", "dist",
  ".cache", ".turbo", "coverage", ".nyc_output", ".parcel-cache",
]);

export const GET = routeWithWorkspace(async ({ url, workspaceDir }) => {
  const relativePath = url.searchParams.get("path") || "";
  const showHidden = url.searchParams.get("showHidden") === "true";

  if (relativePath.includes("..")) {
    throw badRequest("Invalid path");
  }

  const resolved = path.resolve(workspaceDir, relativePath);
  if (!resolved.startsWith(workspaceDir + path.sep) && resolved !== workspaceDir) {
    throw badRequest("Invalid path");
  }

  try {
    const dirents = await fs.readdir(resolved, { withFileTypes: true });
    let entries = dirents
      .filter((d) => d.isDirectory() || d.isFile())
      .filter((d) => {
        if (showHidden) return true;
        if (d.name.startsWith(".")) return false;
        if (d.isDirectory() && HIDDEN_DIRS.has(d.name)) return false;
        return true;
      })
      .map((d) => ({
        name: d.name,
        type: d.isDirectory() ? ("directory" as const) : ("file" as const),
        path: relativePath ? `${relativePath}/${d.name}` : d.name,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const truncated = entries.length > 500;
    if (truncated) entries = entries.slice(0, 500);

    return { entries, truncated };
  } catch {
    throw serverError("Cannot read directory");
  }
});
