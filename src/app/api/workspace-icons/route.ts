import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { badRequest, route } from "@/lib/api-route";

const ICONS_DIR = path.join(os.homedir(), ".entourage", "workspace-icons");
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mime] ?? "png";
}

export const POST = route(async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    throw badRequest("No file provided");
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    throw badRequest(`Invalid file type: ${file.type}. Allowed: png, jpg, gif, webp`);
  }

  if (file.size > MAX_SIZE) {
    throw badRequest("File too large. Max 2MB");
  }

  await mkdir(ICONS_DIR, { recursive: true });

  const imageId = crypto.randomUUID();
  const ext = extFromMime(file.type);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(ICONS_DIR, `${imageId}.${ext}`), buffer);

  return { imageId, ext };
});
