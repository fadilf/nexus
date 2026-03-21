import { removeWorkspace, updateWorkspace, loadWorkspaces } from "@/lib/workspace-store";
import { unlink } from "fs/promises";
import path from "path";
import os from "os";
import { badRequest, getErrorMessage, route, routeWithJson } from "@/lib/api-route";

const ICONS_DIR = path.join(os.homedir(), ".entourage", "workspace-icons");

export const PATCH = routeWithJson<{ workspaceId: string }, Record<string, unknown>>(async ({ params, body: updates }) => {
  try {
    if ("icon" in updates) {
      const workspaces = await loadWorkspaces();
      const existing = workspaces.find((w) => w.id === params.workspaceId);
      if (existing?.icon?.type === "image") {
        const oldPath = path.join(ICONS_DIR, `${existing.icon.imageId}.${existing.icon.ext}`);
        await unlink(oldPath).catch(() => {});
      }
    }

    return await updateWorkspace(params.workspaceId, updates);
  } catch (err) {
    throw badRequest(getErrorMessage(err, "Failed to update workspace"));
  }
});

export const DELETE = route<{ workspaceId: string }>(async ({ params }) => {
  try {
    const workspaces = await loadWorkspaces();
    const existing = workspaces.find((w) => w.id === params.workspaceId);
    if (existing?.icon?.type === "image") {
      const iconPath = path.join(ICONS_DIR, `${existing.icon.imageId}.${existing.icon.ext}`);
      await unlink(iconPath).catch(() => {});
    }

    await removeWorkspace(params.workspaceId);
    return { ok: true };
  } catch (err) {
    throw badRequest(getErrorMessage(err, "Failed to delete workspace"));
  }
});
