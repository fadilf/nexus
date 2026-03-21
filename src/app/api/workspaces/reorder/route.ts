import { reorderWorkspaces } from "@/lib/workspace-store";
import { badRequest, getErrorMessage, routeWithJson } from "@/lib/api-route";

type ReorderWorkspacesBody = {
  orderedIds?: string[];
};

export const PUT = routeWithJson<Record<string, never>, ReorderWorkspacesBody>(async ({ body }) => {
  const { orderedIds } = body;
  if (!Array.isArray(orderedIds)) {
    throw badRequest("orderedIds must be an array");
  }

  try {
    return await reorderWorkspaces(orderedIds);
  } catch (err) {
    throw badRequest(getErrorMessage(err, "Failed to reorder workspaces"));
  }
});
