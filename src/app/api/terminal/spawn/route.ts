import { getTerminalManager } from "@/lib/terminal-manager";
import crypto from "crypto";
import { routeWithWorkspaceJson } from "@/lib/api-route";

type TerminalSpawnBody = {
  sessionId?: string;
};

export const POST = routeWithWorkspaceJson<Record<string, never>, TerminalSpawnBody>(
  async ({ body, url, workspaceDir }) => {
    const sessionId = body.sessionId || crypto.randomUUID();
    const workspaceId = url.searchParams.get("workspaceId") || "";

    const tm = getTerminalManager();

    const existing = tm.getSession(sessionId);
    if (existing) {
      return { sessionId, reattached: true };
    }

    tm.spawn(sessionId, workspaceId, workspaceDir);
    return { sessionId };
  },
  { optional: true }
);
