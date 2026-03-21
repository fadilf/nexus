import simpleGit from "simple-git";
import { getErrorMessage, routeWithWorkspace, serverError } from "@/lib/api-route";

export const POST = routeWithWorkspace(async ({ workspaceDir }) => {
  const git = simpleGit(workspaceDir);

  try {
    const result = await git.pull();
    return {
      summary: {
        changes: result.summary.changes,
        insertions: result.summary.insertions,
        deletions: result.summary.deletions,
      },
      files: result.files,
    };
  } catch (err) {
    throw serverError(getErrorMessage(err, "Git error"));
  }
});
