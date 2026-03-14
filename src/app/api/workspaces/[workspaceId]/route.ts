import { NextResponse } from "next/server";
import { removeWorkspace, updateWorkspace } from "@/lib/workspace-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const updates = await request.json();

  try {
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
    await removeWorkspace(workspaceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
