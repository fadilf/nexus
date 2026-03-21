import { loadAgents, loadDisplayName, saveDisplayName, loadPlugins, savePlugins, loadQuickReplies, saveQuickReplies, loadToolCallGrouping, saveToolCallGrouping } from "@/lib/agent-store";
import { route, routeWithJson } from "@/lib/api-route";

type ConfigBody = {
  displayName?: string;
  plugins?: Record<string, boolean>;
  quickRepliesEnabled?: boolean;
  toolCallGroupingEnabled?: boolean;
};

export const GET = route(async () => {
  const [agents, displayName, plugins, quickReplies, toolCallGrouping] = await Promise.all([
    loadAgents(),
    loadDisplayName(),
    loadPlugins(),
    loadQuickReplies(),
    loadToolCallGrouping(),
  ]);
  return { agents, displayName, plugins, quickReplies, toolCallGrouping };
});

export const PATCH = routeWithJson<Record<string, never>, ConfigBody>(async ({ body }) => {
  if (typeof body.displayName === "string") {
    await saveDisplayName(body.displayName.trim());
  }

  if (body.plugins && typeof body.plugins === "object") {
    await savePlugins(body.plugins);
  }

  if (typeof body.quickRepliesEnabled === "boolean") {
    await saveQuickReplies({ enabled: body.quickRepliesEnabled });
  }

  if (typeof body.toolCallGroupingEnabled === "boolean") {
    await saveToolCallGrouping({ enabled: body.toolCallGroupingEnabled });
  }

  const [displayName, plugins, quickReplies, toolCallGrouping] = await Promise.all([
    loadDisplayName(),
    loadPlugins(),
    loadQuickReplies(),
    loadToolCallGrouping(),
  ]);
  return { displayName, plugins, quickReplies, toolCallGrouping };
});
