import { getProcessManager } from "@/lib/process-manager";
import { listThreads } from "@/lib/thread-store";
import { routeWithWorkspace } from "@/lib/api-route";

export const GET = routeWithWorkspace(async ({ workspaceDir }) => {
  const pm = getProcessManager();
  const statuses = pm.getAllStatuses();
  const threads = await listThreads(workspaceDir);

  const unreadByThread: Record<string, string[]> = {};
  for (const t of threads) {
    if (t.unreadAgents && t.unreadAgents.length > 0) {
      unreadByThread[t.id] = t.unreadAgents;
    }
  }

  return { statuses, unreadByThread };
});
