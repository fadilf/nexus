import { loadMcpServers, addMcpServer } from "@/lib/mcp-store";
import { getMcpClientManager } from "@/lib/mcp-client-manager";
import { badRequest, getErrorMessage, route, routeWithJson } from "@/lib/api-route";

type McpServerBody = {
  name?: string;
  transport?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
};

export const GET = route(async () => {
  const servers = await loadMcpServers();
  const manager = getMcpClientManager();
  const statuses = manager.getConnectionStatus();
  const statusMap = new Map(statuses.map((s) => [s.serverId, s]));
  return servers.map((s) => ({
    ...s,
    connected: statusMap.has(s.id),
    appToolCount: statusMap.get(s.id)?.toolCount ?? 0,
  }));
});

export const POST = routeWithJson<Record<string, never>, McpServerBody>(async ({ body }) => {
  const { name, transport, command, args, env, url } = body;
  if (!name) {
    throw badRequest("name is required");
  }
  const isSSE = transport === "sse";
  if (isSSE && !url) {
    throw badRequest("url is required for remote servers");
  }
  if (!isSSE && !command) {
    throw badRequest("command is required for local servers");
  }

  const server = await addMcpServer({
    name,
    transport: isSSE ? "sse" : "stdio",
    ...(isSSE
      ? { url }
      : { command, args: args ?? [], env: env ?? undefined }),
  });
  const manager = getMcpClientManager();
  try {
    await manager.connect(server);
  } catch (err) {
    return {
      ...server,
      connected: false,
      error: getErrorMessage(err, "Failed to connect to MCP server"),
    };
  }
  return { ...server, connected: true };
});
