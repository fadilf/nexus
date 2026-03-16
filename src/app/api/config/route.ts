import { NextResponse } from "next/server";
import { loadAgents, loadDisplayName, saveDisplayName } from "@/lib/agent-store";
import { resolveWorkspaceDir } from "@/lib/workspace-context";

export async function GET(request: Request) {
  const workspaceDir = await resolveWorkspaceDir(request);
  const [agents, displayName] = await Promise.all([
    loadAgents(workspaceDir),
    loadDisplayName(workspaceDir),
  ]);
  return NextResponse.json({
    workingDirectory: workspaceDir,
    agents,
    displayName,
  });
}

export async function PATCH(request: Request) {
  const workspaceDir = await resolveWorkspaceDir(request);
  const body = await request.json();

  if (typeof body.displayName === "string") {
    await saveDisplayName(workspaceDir, body.displayName.trim());
  }

  const displayName = await loadDisplayName(workspaceDir);
  return NextResponse.json({ displayName });
}
