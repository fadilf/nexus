import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getUploadsDir } from "@/lib/config";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;

  // Prevent path traversal
  const safe = path.basename(imageId);
  const filePath = path.join(getUploadsDir(), safe);
  const ext = path.extname(safe).slice(1).toLowerCase();
  const contentType = MIME_TYPES[ext];

  if (!contentType) {
    return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
  }

  try {
    const data = await readFile(filePath);
    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
