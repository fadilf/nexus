import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getUploadsDir } from "@/lib/config";
import { MessageImage } from "@/lib/types";
import { badRequest, routeWithWorkspace } from "@/lib/api-route";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mime] ?? "png";
}

export const POST = routeWithWorkspace(async ({ request, workspaceDir }) => {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    throw badRequest("No files provided");
  }

  const uploadsDir = getUploadsDir(workspaceDir);
  await mkdir(uploadsDir, { recursive: true });

  const images: MessageImage[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      throw badRequest(`Invalid file type: ${file.type}. Allowed: png, jpg, gif, webp`);
    }
    if (file.size > MAX_SIZE) {
      throw badRequest(`File too large: ${file.name}. Max 10MB`);
    }

    const id = crypto.randomUUID();
    const ext = extFromMime(file.type);
    const filename = `${id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await writeFile(path.join(uploadsDir, filename), buffer);

    images.push({ id, filename, ext });
  }

  return images;
});
