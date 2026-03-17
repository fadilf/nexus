import { NextResponse } from "next/server";
import { loadWorkspaces, addWorkspace } from "@/lib/workspace-store";
import { stat } from "fs/promises";
import { Icon } from "@/lib/types";

export async function GET() {
  const workspaces = await loadWorkspaces();
  return NextResponse.json(workspaces);
}

export async function POST(request: Request) {
  const { directory, name, color, icon } = (await request.json()) as {
    directory: string;
    name?: string;
    color?: string;
    icon?: Icon;
  };

  if (!directory) {
    return NextResponse.json({ error: "directory is required" }, { status: 400 });
  }

  // Validate directory exists
  try {
    const stats = await stat(directory);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Directory does not exist" }, { status: 400 });
  }

  try {
    const workspace = await addWorkspace(directory, name, color, icon);
    return NextResponse.json(workspace, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
