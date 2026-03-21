import simpleGit from "simple-git";
import { badRequest, getErrorMessage, routeWithWorkspaceJson, serverError } from "@/lib/api-route";

type GitCommitBody = {
  message?: string;
};

export const POST = routeWithWorkspaceJson<Record<string, never>, GitCommitBody>(async ({ body, workspaceDir }) => {
  const { message } = body;
  if (!message || typeof message !== "string" || !message.trim()) {
    throw badRequest("Commit message required");
  }

  const git = simpleGit(workspaceDir);

  try {
    const result = await git.commit(message.trim());
    return {
      hash: result.commit || "",
      message: message.trim(),
    };
  } catch (err) {
    throw serverError(getErrorMessage(err, "Git error"));
  }
});
