import { NextResponse } from "next/server";
import { resolveWorkspaceDir } from "@/lib/workspace-context";
import simpleGit from "simple-git";

export async function POST(request: Request) {
  let dir: string;
  try {
    dir = await resolveWorkspaceDir(request);
  } catch {
    return NextResponse.json({ error: "Workspace not found" }, { status: 400 });
  }

  const git = simpleGit(dir);

  try {
    const result = await git.pull();
    return NextResponse.json({
      summary: {
        changes: result.summary.changes,
        insertions: result.summary.insertions,
        deletions: result.summary.deletions,
      },
      files: result.files,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Git error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
