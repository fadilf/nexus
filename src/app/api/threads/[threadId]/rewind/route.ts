import { getProcessManager } from "@/lib/process-manager";
import { getThread, truncateAfterMessage, truncateBeforeMessage } from "@/lib/thread-store";
import { restoreSnapshot, hasSnapshot } from "@/lib/snapshots";
import { badRequest, conflict, notFound, routeWithWorkspaceJson } from "@/lib/api-route";

type RewindThreadBody = {
  messageId?: string;
  keepMessage?: boolean;
  revertCode?: boolean;
};

export const POST = routeWithWorkspaceJson<{ threadId: string }, RewindThreadBody>(
  async ({ params, workspaceDir, body }) => {
    const { messageId, keepMessage = true, revertCode = false } = body;
  if (!messageId) {
      throw badRequest("messageId required");
  }

  const pm = getProcessManager();

    if (pm.isThreadStreaming(params.threadId)) {
      throw conflict("Cannot rewind while agents are streaming");
  }

    const currentThread = await getThread(workspaceDir, params.threadId);
  if (!currentThread) {
      throw notFound("Thread not found");
  }

    pm.killByThread(params.threadId);
    pm.resetSessions(params.threadId, currentThread.agents.map((a) => a.id));

    if (revertCode) {
      const targetIndex = currentThread.messages.findIndex((m) => m.id === messageId);
      let snapshotHash: string | undefined;
      if (keepMessage) {
        const nextAssistant = currentThread.messages
          .slice(targetIndex + 1)
          .find((m) => m.role === "assistant" && m.snapshotTreeHash);
        snapshotHash = nextAssistant?.snapshotTreeHash;
      } else {
        const msg = currentThread.messages[targetIndex];
        if (msg?.role === "assistant" && msg.snapshotTreeHash) {
          snapshotHash = msg.snapshotTreeHash;
        } else {
          const nextAssistant = currentThread.messages
            .slice(targetIndex)
            .find((m) => m.role === "assistant" && m.snapshotTreeHash);
          snapshotHash = nextAssistant?.snapshotTreeHash;
        }
      }

      if (snapshotHash && (await hasSnapshot(workspaceDir, snapshotHash))) {
        await restoreSnapshot(workspaceDir, snapshotHash);
      }
    }

    const thread = keepMessage
      ? await truncateAfterMessage(workspaceDir, params.threadId, messageId)
      : await truncateBeforeMessage(workspaceDir, params.threadId, messageId);
  if (!thread) {
      throw notFound("Thread or message not found");
  }

    return thread;
  }
);
