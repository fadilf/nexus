import fs from "fs/promises";
import path from "path";
import os from "os";
import { ApiRouteError, badRequest, route } from "@/lib/api-route";

export const GET = route(async ({ url }) => {
  const requestedPath = url.searchParams.get("path") || os.homedir();
  const resolved = path.resolve(requestedPath);

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      throw badRequest("Not a directory");
    }

    const dirents = await fs.readdir(resolved, { withFileTypes: true });
    const entries = dirents
      .filter((d) => d.isDirectory() || d.isFile())
      .map((d) => ({
        name: d.name,
        type: d.isDirectory() ? ("directory" as const) : ("file" as const),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return { path: resolved, entries };
  } catch (error) {
    if (error instanceof ApiRouteError) {
      throw error;
    }
    throw badRequest("Cannot read directory");
  }
});
