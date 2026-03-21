import simpleGit from "simple-git";
import { getErrorMessage, routeWithWorkspace, serverError } from "@/lib/api-route";

export const POST = routeWithWorkspace(async ({ workspaceDir }) => {
  const git = simpleGit(workspaceDir);

  try {
    await git.fetch();
    return { fetched: true };
  } catch (err) {
    throw serverError(getErrorMessage(err, "Git error"));
  }
});
