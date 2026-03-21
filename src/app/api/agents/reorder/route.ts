import { reorderAgents } from "@/lib/agent-store";
import { badRequest, getErrorMessage, routeWithJson } from "@/lib/api-route";

type ReorderAgentsBody = {
  orderedIds?: string[];
};

export const PUT = routeWithJson<Record<string, never>, ReorderAgentsBody>(async ({ body }) => {
  const { orderedIds } = body;
  if (!Array.isArray(orderedIds)) {
    throw badRequest("orderedIds must be an array");
  }

  try {
    return await reorderAgents(orderedIds);
  } catch (err) {
    throw badRequest(getErrorMessage(err, "Failed to reorder agents"));
  }
});
