import { getMcpClientManager } from "@/lib/mcp-client-manager";
import { ApiRouteError, badRequest, getErrorMessage, routeWithJson, serverError } from "@/lib/api-route";

type McpProxyBody = {
  action?: string;
  serverId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  uri?: string;
};

export const POST = routeWithJson<Record<string, never>, McpProxyBody>(async ({ body }) => {
  const { action, serverId, toolName, args, uri } = body;
  const manager = getMcpClientManager();

  try {
    if (action === "readResource") {
      if (!serverId || !uri) {
        throw badRequest("serverId and uri are required");
      }
      const html = await manager.readResource(serverId, uri);
      return { html };
    }
    if (action === "callTool") {
      if (!serverId || !toolName) {
        throw badRequest("serverId and toolName are required");
      }
      const result = await manager.callTool(serverId, toolName, args ?? {});
      return { result };
    }
    throw badRequest("Unknown action");
  } catch (err) {
    if (err instanceof ApiRouteError) {
      throw err;
    }
    throw serverError(getErrorMessage(err, "MCP proxy error"));
  }
});
