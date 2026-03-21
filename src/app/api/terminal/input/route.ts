import { getTerminalManager } from "@/lib/terminal-manager";
import { badRequest, notFound, routeWithJson } from "@/lib/api-route";

type TerminalInputBody = {
  sessionId?: string;
  data?: string;
};

export const POST = routeWithJson<Record<string, never>, TerminalInputBody>(async ({ body }) => {
  const { sessionId, data } = body;
  if (!sessionId || typeof data !== "string") {
    throw badRequest("sessionId and data are required");
  }

  const tm = getTerminalManager();
  const ok = tm.write(sessionId, data);

  if (!ok) {
    throw notFound("Session not found");
  }

  return { ok: true };
}, { optional: true });
