import { NextResponse } from "next/server";
import { removeWorkspace, updateWorkspace, loadWorkspaces } from "@/lib/workspace-store";
import { unlink } from "fs/promises";
import path from "path";
import os from "os";

const ICONS_DIR = path.join(os.homedir(), ".entourage", "workspace-icons");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const updates = await request.json();

  try {
    // If icon is changing, clean up the old image file
    if ("icon" in updates) {
      const workspaces = await loadWorkspaces();
      const existing = workspaces.find((w) => w.id === workspaceId);
      if (existing?.icon?.type === "image") {
        const oldPath = path.join(ICONS_DIR, `${existing.icon.imageId}.${existing.icon.ext}`);
        await unlink(oldPath).catch(() => {});
      }
    }

    const workspace = await updateWorkspace(workspaceId, updates);
    return NextResponse.json(workspace);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  try {
    // Clean up image icon file if present
    const workspaces = await loadWorkspaces();
    const existing = workspaces.find((w) => w.id === workspaceId);
    if (existing?.icon?.type === "image") {
      const iconPath = path.join(ICONS_DIR, `${existing.icon.imageId}.${existing.icon.ext}`);
      await unlink(iconPath).catch(() => {});
    }

    await removeWorkspace(workspaceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
