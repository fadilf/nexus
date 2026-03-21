import { updateAgent, deleteAgent } from "@/lib/agent-store";
import { badRequest, getErrorMessage, route, routeWithJson } from "@/lib/api-route";

export const PUT = routeWithJson<{ agentId: string }, Record<string, unknown>>(async ({ params, body }) => {
  try {
    return await updateAgent(params.agentId, body);
  } catch (err) {
    throw badRequest(getErrorMessage(err, "Failed to update agent"));
  }
});

export const DELETE = route<{ agentId: string }>(async ({ params }) => {
  try {
    await deleteAgent(params.agentId);
    return { ok: true };
  } catch (err) {
    throw badRequest(getErrorMessage(err, "Failed to delete agent"));
  }
});
