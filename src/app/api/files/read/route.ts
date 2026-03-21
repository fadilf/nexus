import fs from "fs/promises";
import path from "path";
import { ApiRouteError, badRequest, routeWithWorkspace, serverError } from "@/lib/api-route";

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

const LANGUAGE_MAP: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
  py: "Python", rs: "Rust", go: "Go", java: "Java", rb: "Ruby",
  css: "CSS", scss: "SCSS", html: "HTML", json: "JSON", yaml: "YAML",
  yml: "YAML", md: "Markdown", sh: "Shell", bash: "Shell", zsh: "Shell",
  sql: "SQL", toml: "TOML", xml: "XML", svg: "SVG", c: "C", cpp: "C++",
  h: "C", hpp: "C++", cs: "C#", swift: "Swift", kt: "Kotlin",
  dockerfile: "Dockerfile", makefile: "Makefile",
};

function getLanguage(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (LANGUAGE_MAP[base]) return LANGUAGE_MAP[base]; // e.g. "Dockerfile"
  const ext = base.split(".").pop() ?? "";
  return LANGUAGE_MAP[ext] ?? "Plain Text";
}

export const GET = routeWithWorkspace(async ({ url, workspaceDir }) => {
  const relativePath = url.searchParams.get("path") || "";

  if (!relativePath) {
    throw badRequest("path parameter is required");
  }

  if (relativePath.includes("..")) {
    throw badRequest("Invalid path");
  }

  const resolved = path.resolve(workspaceDir, relativePath);
  if (!resolved.startsWith(workspaceDir + path.sep) && resolved !== workspaceDir) {
    throw badRequest("Invalid path");
  }

  try {
    const stat = await fs.stat(resolved);

    if (stat.size > MAX_FILE_SIZE) {
      throw badRequest(`File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB.`);
    }

    const fd = await fs.open(resolved, "r");
    const probe = Buffer.alloc(Math.min(8192, stat.size));
    await fd.read(probe, 0, probe.length, 0);
    await fd.close();

    if (probe.includes(0)) {
      throw badRequest("Binary file — preview not available");
    }

    const content = await fs.readFile(resolved, "utf-8");
    const language = getLanguage(relativePath);

    return { content, language, size: stat.size };
  } catch (error) {
    if (error instanceof ApiRouteError) {
      throw error;
    }
    throw serverError("Cannot read file");
  }
});
