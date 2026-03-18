import { NextResponse } from "next/server";
import { loadAgents, loadDisplayName, saveDisplayName, loadPlugins, savePlugins } from "@/lib/agent-store";

export async function GET() {
  const [agents, displayName, plugins] = await Promise.all([
    loadAgents(),
    loadDisplayName(),
    loadPlugins(),
  ]);
  return NextResponse.json({ agents, displayName, plugins });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  if (typeof body.displayName === "string") {
    await saveDisplayName(body.displayName.trim());
  }

  if (body.plugins && typeof body.plugins === "object") {
    await savePlugins(body.plugins);
  }

  const [displayName, plugins] = await Promise.all([
    loadDisplayName(),
    loadPlugins(),
  ]);
  return NextResponse.json({ displayName, plugins });
}
