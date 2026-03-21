import { getProcessManager } from "@/lib/process-manager";
import { badRequest, routeWithJson } from "@/lib/api-route";

type StopThreadBody = {
  agentId?: string;
};

export const POST = routeWithJson<{ threadId: string }, StopThreadBody>(async ({ params, body }) => {
  const { agentId } = body;
  if (!agentId) {
    throw badRequest("agentId required");
  }

  const pm = getProcessManager();
  pm.kill(params.threadId, agentId);

  return pm.getStatus(params.threadId, agentId);
});
