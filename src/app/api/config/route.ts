import { NextResponse } from "next/server";
import { loadAgents } from "@/lib/agent-store";
import { resolveWorkspaceDir } from "@/lib/workspace-context";

export async function GET(request: Request) {
  const workspaceDir = await resolveWorkspaceDir(request);
  const agents = await loadAgents(workspaceDir);
  return NextResponse.json({
    workingDirectory: workspaceDir,
    agents,
  });
}
