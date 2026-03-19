import { NextResponse } from "next/server";
import { loadAgents, loadDisplayName, saveDisplayName, loadPlugins, savePlugins, loadQuickReplies, saveQuickReplies } from "@/lib/agent-store";

export async function GET() {
  const [agents, displayName, plugins, quickReplies] = await Promise.all([
    loadAgents(),
    loadDisplayName(),
    loadPlugins(),
    loadQuickReplies(),
  ]);
  return NextResponse.json({ agents, displayName, plugins, quickReplies });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  if (typeof body.displayName === "string") {
    await saveDisplayName(body.displayName.trim());
  }

  if (body.plugins && typeof body.plugins === "object") {
    await savePlugins(body.plugins);
  }

  if (typeof body.quickRepliesEnabled === "boolean") {
    await saveQuickReplies({ enabled: body.quickRepliesEnabled });
  }


  const [displayName, plugins, quickReplies] = await Promise.all([
    loadDisplayName(),
    loadPlugins(),
    loadQuickReplies(),
  ]);
  return NextResponse.json({ displayName, plugins, quickReplies });
}
