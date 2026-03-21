import { getTerminalManager } from "@/lib/terminal-manager";
import { badRequest, notFound, routeWithJson } from "@/lib/api-route";

type TerminalResizeBody = {
  sessionId?: string;
  cols?: number;
  rows?: number;
};

export const POST = routeWithJson<Record<string, never>, TerminalResizeBody>(async ({ body }) => {
  const { sessionId, cols, rows } = body;
  if (!sessionId || typeof cols !== "number" || typeof rows !== "number") {
    throw badRequest("sessionId, cols, and rows are required");
  }

  const tm = getTerminalManager();
  const ok = tm.resize(sessionId, cols, rows);

  if (!ok) {
    throw notFound("Session not found");
  }

  return { ok: true };
}, { optional: true });
