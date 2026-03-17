import { NextResponse } from "next/server";
import { getProcessManager } from "@/lib/process-manager";
import { truncateAfterMessage } from "@/lib/thread-store";
import { resolveWorkspaceDir } from "@/lib/workspace-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const { messageId } = (await request.json()) as { messageId: string };

  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  const workspaceDir = await resolveWorkspaceDir(request);
  const pm = getProcessManager();

  if (pm.isThreadStreaming(threadId)) {
    return NextResponse.json(
      { error: "Cannot rewind while agents are streaming" },
      { status: 409 }
    );
  }

  pm.killByThread(threadId);

  const thread = await truncateAfterMessage(workspaceDir, threadId, messageId);
  if (!thread) {
    return NextResponse.json({ error: "Thread or message not found" }, { status: 404 });
  }

  return NextResponse.json(thread);
}
