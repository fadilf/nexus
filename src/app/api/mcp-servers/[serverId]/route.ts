import { removeMcpServer } from "@/lib/mcp-store";
import { getMcpClientManager } from "@/lib/mcp-client-manager";
import { route } from "@/lib/api-route";

export const DELETE = route<{ serverId: string }>(async ({ params }) => {
  const manager = getMcpClientManager();
  await manager.disconnect(params.serverId);
  await removeMcpServer(params.serverId);
  return { ok: true };
});
