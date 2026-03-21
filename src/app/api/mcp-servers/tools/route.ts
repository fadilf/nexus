import { getMcpClientManager } from "@/lib/mcp-client-manager";
import { route } from "@/lib/api-route";

export const GET = route(async () => {
  const manager = getMcpClientManager();
  return manager.getAllAppTools();
});
