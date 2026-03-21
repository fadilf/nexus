import simpleGit from "simple-git";
import { GitFileEntry, GitStatus } from "@/lib/types";
import { mapGitStatus } from "@/lib/plugins";
import { getErrorMessage, routeWithWorkspace, serverError } from "@/lib/api-route";

export const GET = routeWithWorkspace(async ({ workspaceDir }) => {
  const git = simpleGit(workspaceDir);

  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return { isRepo: false, branch: "", staged: [], unstaged: [], ahead: 0, behind: 0 } satisfies GitStatus;
    }

    const status = await git.status();

    const staged: GitFileEntry[] = [];
    const unstaged: GitFileEntry[] = [];

    for (const file of status.files) {
      if (file.index && file.index !== " " && file.index !== "?") {
        staged.push({
          path: file.path,
          status: mapGitStatus(file.index),
        });
      }
      if (file.working_dir && file.working_dir !== " ") {
        unstaged.push({
          path: file.path,
          status: file.working_dir === "?" ? "untracked" : mapGitStatus(file.working_dir),
        });
      }
    }

    return {
      isRepo: true,
      branch: status.current ?? "",
      staged,
      unstaged,
      ahead: status.ahead,
      behind: status.behind,
    } satisfies GitStatus;
  } catch (err) {
    throw serverError(getErrorMessage(err, "Git error"));
  }
});
