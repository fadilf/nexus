import { loadWorkspaces, addWorkspace } from "@/lib/workspace-store";
import { stat } from "fs/promises";
import { Icon } from "@/lib/types";
import { ApiRouteError, badRequest, created, getErrorMessage, route, routeWithJson } from "@/lib/api-route";

type CreateWorkspaceBody = {
  directory?: string;
  name?: string;
  color?: string;
  icon?: Icon;
};

export const GET = route(async () => loadWorkspaces());

export const POST = routeWithJson<Record<string, never>, CreateWorkspaceBody>(async ({ body }) => {
  const { directory, name, color, icon } = body;
  if (!directory) {
    throw badRequest("directory is required");
  }

  try {
    const stats = await stat(directory);
    if (!stats.isDirectory()) {
      throw badRequest("Path is not a directory");
    }
  } catch (error) {
    if (error instanceof ApiRouteError) {
      throw error;
    }
    throw badRequest("Directory does not exist");
  }

  try {
    const workspace = await addWorkspace(directory, name, color, icon);
    return created(workspace);
  } catch (err) {
    throw badRequest(getErrorMessage(err, "Failed to add workspace"));
  }
});
