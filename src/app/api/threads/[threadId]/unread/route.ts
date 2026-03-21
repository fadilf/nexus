import { addUnreadAgent } from "@/lib/thread-store";
import { badRequest, routeWithWorkspaceJson } from "@/lib/api-route";

type UnreadBody = {
  agentId?: string;
};

export const POST = routeWithWorkspaceJson<{ threadId: string }, UnreadBody>(async ({ params, body, workspaceDir }) => {
  const { agentId } = body;
  if (!agentId) {
    throw badRequest("agentId required");
  }

  await addUnreadAgent(workspaceDir, params.threadId, agentId);
  return { ok: true };
});
