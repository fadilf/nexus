import { NextResponse } from "next/server";
import { reorderWorkspaces } from "@/lib/workspace-store";

export async function PUT(request: Request) {
  const { orderedIds } = (await request.json()) as { orderedIds: string[] };

  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds must be an array" }, { status: 400 });
  }

  try {
    const workspaces = await reorderWorkspaces(orderedIds);
    return NextResponse.json(workspaces);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
