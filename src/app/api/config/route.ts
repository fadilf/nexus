import { NextResponse } from "next/server";
import { loadAgents, loadDisplayName, saveDisplayName, loadPlugins, savePlugins, loadQuickRepliesConfig, saveQuickRepliesConfig } from "@/lib/agent-store";

export async function GET() {
  const [agents, displayName, plugins, quickReplies] = await Promise.all([
    loadAgents(),
    loadDisplayName(),
    loadPlugins(),
    loadQuickRepliesConfig(),
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

  if (typeof body.quickRepliesEnabled === "boolean" || typeof body.quickRepliesAgentId === "string") {
    await saveQuickRepliesConfig({
      enabled: typeof body.quickRepliesEnabled === "boolean" ? body.quickRepliesEnabled : undefined,
      agentId: typeof body.quickRepliesAgentId === "string" ? body.quickRepliesAgentId : undefined,
    });
  }

  const [displayName, plugins, quickReplies] = await Promise.all([
    loadDisplayName(),
    loadPlugins(),
    loadQuickRepliesConfig(),
  ]);
  return NextResponse.json({ displayName, plugins, quickReplies });
}
