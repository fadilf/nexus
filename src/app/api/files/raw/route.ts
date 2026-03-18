import { NextResponse } from "next/server";
import { resolveWorkspaceDir } from "@/lib/workspace-context";
import fs from "fs/promises";
import path from "path";

const MAX_RAW_SIZE = 10 * 1024 * 1024; // 10MB

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

export async function GET(request: Request) {
  let dir: string;
  try {
    dir = await resolveWorkspaceDir(request);
  } catch {
    return NextResponse.json({ error: "Workspace not found" }, { status: 400 });
  }

  const url = new URL(request.url);
  const relativePath = url.searchParams.get("path") || "";

  if (!relativePath) {
    return NextResponse.json({ error: "path parameter is required" }, { status: 400 });
  }

  if (relativePath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const resolved = path.resolve(dir, relativePath);
  if (!resolved.startsWith(dir + path.sep) && resolved !== dir) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const ext = path.extname(resolved).slice(1).toLowerCase();
  const mimeType = MIME_TYPES[ext];
  if (!mimeType) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(resolved);

    if (stat.size > MAX_RAW_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.` },
        { status: 400 }
      );
    }

    const buffer = await fs.readFile(resolved);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(stat.size),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Cannot read file" }, { status: 500 });
  }
}
