import { NextResponse } from "next/server";
import { loadAgents, createAgent } from "@/lib/agent-store";
import { resolveWorkspaceDir } from "@/lib/workspace-context";

export async function GET(request: Request) {
  const workspaceDir = await resolveWorkspaceDir(request);
  const agents = await loadAgents(workspaceDir);
  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  const workspaceDir = await resolveWorkspaceDir(request);
  const body = await request.json();
  const { name, model, avatarColor, icon, personality } = body;

  if (!name || !model || !avatarColor) {
    return NextResponse.json({ error: "name, model, and avatarColor are required" }, { status: 400 });
  }

  try {
    const agent = await createAgent(workspaceDir, { name, model, avatarColor, icon, personality });
    return NextResponse.json(agent, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
