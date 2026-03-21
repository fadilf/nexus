import { getTerminalManager } from "@/lib/terminal-manager";
import { badRequest, routeWithJson } from "@/lib/api-route";

type TerminalKillBody = {
  sessionId?: string;
};

export const POST = routeWithJson<Record<string, never>, TerminalKillBody>(async ({ body }) => {
  const { sessionId } = body;
  if (!sessionId) {
    throw badRequest("sessionId is required");
  }

  const tm = getTerminalManager();
  tm.kill(sessionId);

  return { ok: true };
}, { optional: true });
