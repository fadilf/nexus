import simpleGit from "simple-git";
import { readFile } from "fs/promises";
import path from "path";
import { badRequest, getErrorMessage, routeWithWorkspace, serverError } from "@/lib/api-route";

export const GET = routeWithWorkspace(async ({ url, workspaceDir }) => {
  const file = url.searchParams.get("file");
  const staged = url.searchParams.get("staged") === "true";

  if (!file) {
    throw badRequest("file parameter required");
  }

  const git = simpleGit(workspaceDir);

  try {
    let diff: string;

    if (staged) {
      diff = await git.diff(["--cached", "--find-renames", "--", file]);
    } else {
      diff = await git.diff(["--find-renames", "--", file]);

      if (!diff) {
        try {
          const content = await readFile(path.join(workspaceDir, file), "utf-8");
          const lines = content.split("\n");
          diff = `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` +
            lines.map((l) => `+${l}`).join("\n");
        } catch {
          diff = "";
        }
      }
    }

    return { diff };
  } catch (err) {
    throw serverError(getErrorMessage(err, "Git error"));
  }
});
