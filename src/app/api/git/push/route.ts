import simpleGit from "simple-git";
import { getErrorMessage, routeWithWorkspace, serverError } from "@/lib/api-route";

export const POST = routeWithWorkspace(async ({ workspaceDir }) => {
  const git = simpleGit(workspaceDir);

  try {
    const result = await git.push();
    return {
      pushed: true,
      remoteMessages: result.remoteMessages?.all ?? [],
    };
  } catch (err) {
    throw serverError(getErrorMessage(err, "Git error"));
  }
});
