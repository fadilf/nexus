import simpleGit from "simple-git";
import { GitFileEntry, GitStatus } from "@/lib/types";
import { mapGitStatus } from "@/lib/plugins";
import { badRequest, getErrorMessage, routeWithWorkspaceJson, serverError } from "@/lib/api-route";

type GitStageBody = {
  files?: string[];
  action?: string;
};

export const POST = routeWithWorkspaceJson<Record<string, never>, GitStageBody>(async ({ body, workspaceDir }) => {
  const { files, action } = body;
  if (!Array.isArray(files) || (action !== "stage" && action !== "unstage")) {
    throw badRequest("Invalid request");
  }

  const git = simpleGit(workspaceDir);

  try {
    if (action === "stage") {
      await git.add(files);
    } else {
      await git.raw(["reset", "HEAD", "--", ...files]);
    }

    const status = await git.status();
    const staged: GitFileEntry[] = [];
    const unstaged: GitFileEntry[] = [];

    for (const file of status.files) {
      if (file.index && file.index !== " " && file.index !== "?") {
        staged.push({ path: file.path, status: mapGitStatus(file.index) });
      }
      if (file.working_dir && file.working_dir !== " ") {
        unstaged.push({ path: file.path, status: file.working_dir === "?" ? "untracked" : mapGitStatus(file.working_dir) });
      }
    }

    return {
      isRepo: true,
      branch: status.current ?? "",
      staged,
      unstaged,
      ahead: 0,
      behind: 0,
    } satisfies GitStatus;
  } catch (err) {
    throw serverError(getErrorMessage(err, "Git error"));
  }
});
