import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";

export async function GET(req: NextRequest) {
  const requestedPath = req.nextUrl.searchParams.get("path") || os.homedir();
  const resolved = path.resolve(requestedPath);

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const dirents = await fs.readdir(resolved, { withFileTypes: true });
    const entries = dirents
      .filter((d) => d.isDirectory() || d.isFile())
      .map((d) => ({
        name: d.name,
        type: d.isDirectory() ? ("directory" as const) : ("file" as const),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ path: resolved, entries });
  } catch {
    return NextResponse.json({ error: "Cannot read directory" }, { status: 400 });
  }
}
