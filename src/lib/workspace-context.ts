import { getWorkspaceDir, loadWorkspaces } from "./workspace-store";
import { Workspace } from "./types";
import { ApiRouteError } from "./api-errors";

export async function resolveWorkspaceDir(request: Request): Promise<string> {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    throw new ApiRouteError(400, "workspaceId query parameter is required");
  }
  try {
    return await getWorkspaceDir(workspaceId);
  } catch {
    throw new ApiRouteError(400, "Workspace not found");
  }
}

export async function resolveWorkspace(request: Request): Promise<Workspace> {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    throw new ApiRouteError(400, "workspaceId query parameter is required");
  }
  const workspaces = await loadWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) {
    throw new ApiRouteError(400, "Workspace not found");
  }
  return workspace;
}
