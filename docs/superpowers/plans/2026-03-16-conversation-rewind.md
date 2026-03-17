# Conversation Rewind Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Rewind to here" right-click context menu on messages that truncates the conversation to that point, killing CLI processes and starting fresh sessions on the next message.

**Architecture:** Backend adds `truncateAfterMessage()` to ThreadStore and `killByThread()`/`isThreadStreaming()` to ProcessManager. A new `POST /api/threads/[threadId]/rewind` route orchestrates the rewind. Frontend extracts the existing ContextMenu into a shared component, adds it to message groups, and wires up a confirmation dialog in ThreadDetail.

**Tech Stack:** Next.js App Router API routes, React context menu, existing ThreadStore/ProcessManager patterns

**Spec:** `docs/superpowers/specs/2026-03-16-conversation-rewind-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/process-manager.ts` (modify) | Add `killByThread()` and `isThreadStreaming()` methods |
| `src/lib/thread-store.ts` (modify) | Add `truncateAfterMessage()` function |
| `src/app/api/threads/[threadId]/rewind/route.ts` (create) | POST endpoint orchestrating rewind |
| `src/components/ContextMenu.tsx` (create) | Shared context menu extracted from ThreadList |
| `src/components/ThreadList.tsx` (modify) | Import shared ContextMenu |
| `src/components/MessageList.tsx` (modify) | Add `onRewind` prop, attach context menu to message groups |
| `src/components/MessageGroup.tsx` (modify) | Accept and forward `onRewind` prop |
| `src/components/ThreadDetail.tsx` (modify) | Wire up rewind handler, confirmation dialog, pass callback down |
| `src/app/page.tsx` (modify) | Add `handleRewind` callback, pass to ThreadDetail |

---

### Task 1: ProcessManager — `killByThread()` and `isThreadStreaming()`

**Files:**
- Modify: `src/lib/process-manager.ts:240-298`

- [ ] **Step 1: Add `isThreadStreaming()` method**

Add after the `kill()` method (line 263):

```typescript
isThreadStreaming(threadId: string): boolean {
  for (const [, entry] of this.processes) {
    if (entry.threadId === threadId && entry.status === "running") {
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 2: Add `killedSessions` set**

Add a private field next to `usedSessions` (line 42):

```typescript
private killedSessions = new Set<string>(); // Sessions killed by rewind — skip re-add in close handler
```

Then in the existing `close` handler (around line 232), guard the `usedSessions.add` call:

```typescript
// Change this line:
this.usedSessions.add(sessionId);
// To:
if (!this.killedSessions.has(sessionId)) {
  this.usedSessions.add(sessionId);
}
```

Also add the same guard in the retry close handler (around line 215):

```typescript
// Change this line:
this.usedSessions.add(sessionId);
// To:
if (!this.killedSessions.has(sessionId)) {
  this.usedSessions.add(sessionId);
}
```

- [ ] **Step 3: Add `killByThread()` method**

Add after `isThreadStreaming()`:

```typescript
killByThread(threadId: string): void {
  const toKill: string[] = [];
  for (const [key, entry] of this.processes) {
    if (entry.threadId === threadId) {
      const sessionId = this.getSessionId(entry.threadId, entry.agentId);
      this.usedSessions.delete(sessionId);
      this.killedSessions.add(sessionId); // Prevent close handler from re-adding
      try {
        entry.process.kill("SIGTERM");
        const timer = setTimeout(() => {
          try { entry.process.kill("SIGKILL"); } catch { /* already dead */ }
        }, 5000);
        entry.process.on("close", () => clearTimeout(timer));
      } catch { /* already dead */ }
      toKill.push(key);
    }
  }
  for (const key of toKill) {
    this.processes.delete(key);
  }
}
```

Note: `killedSessions` entries are cleared implicitly when the next `spawn()` for that agent starts a fresh session (it won't be in `usedSessions`, so it starts fresh with `--session-id`).

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/process-manager.ts
git commit -m "feat(rewind): add killByThread and isThreadStreaming to ProcessManager"
```

---

### Task 2: ThreadStore — `truncateAfterMessage()`

**Files:**
- Modify: `src/lib/thread-store.ts`

- [ ] **Step 1: Add `truncateAfterMessage()` function**

Add before the `deleteThread()` function (line 244):

```typescript
export async function truncateAfterMessage(
  workspaceDir: string,
  threadId: string,
  messageId: string
): Promise<ThreadWithMessages | null> {
  return withLock(threadId, async () => {
    const raw = await readFile(getThreadPath(workspaceDir, threadId), "utf-8");
    const thread = JSON.parse(raw) as ThreadWithMessages;

    const index = thread.messages.findIndex((m) => m.id === messageId);
    if (index === -1) return null;

    thread.messages = thread.messages.slice(0, index + 1);

    // Fix any stale streaming messages at or before the truncation point
    for (const msg of thread.messages) {
      if (msg.status === "streaming") {
        msg.status = "error";
        msg.content += "\n\n[Stream interrupted]";
      }
    }

    thread.updatedAt = new Date().toISOString();
    await writeFile(getThreadPath(workspaceDir, threadId), JSON.stringify(thread, null, 2));
    return thread;
  });
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/thread-store.ts
git commit -m "feat(rewind): add truncateAfterMessage to thread store"
```

---

### Task 3: API Route — `POST /api/threads/[threadId]/rewind`

**Files:**
- Create: `src/app/api/threads/[threadId]/rewind/route.ts`

- [ ] **Step 1: Create the rewind route**

Reference the existing stop route at `src/app/api/threads/[threadId]/stop/route.ts` for conventions. Create:

```typescript
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
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/threads/\[threadId\]/rewind/route.ts
git commit -m "feat(rewind): add POST /api/threads/[threadId]/rewind endpoint"
```

---

### Task 4: Extract Shared ContextMenu Component

**Files:**
- Create: `src/components/ContextMenu.tsx`
- Modify: `src/components/ThreadList.tsx:21-63`

- [ ] **Step 1: Create shared ContextMenu component**

Extract the `ContextMenu` function from `ThreadList.tsx` (lines 21-63) into its own file. The component is identical — just re-exported:

```typescript
"use client";

import { useRef, useEffect } from "react";

export default function ContextMenu({
  x,
  y,
  onClose,
  items,
}: {
  x: number;
  y: number;
  onClose: () => void;
  items: { label: string; icon: React.ReactNode; onClick: () => void }[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update ThreadList.tsx to import the shared component**

In `src/components/ThreadList.tsx`:
- Remove the local `ContextMenu` function (lines 21-63)
- Add import: `import ContextMenu from "./ContextMenu";`

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: No type errors, ThreadList works identically

- [ ] **Step 4: Commit**

```bash
git add src/components/ContextMenu.tsx src/components/ThreadList.tsx
git commit -m "refactor: extract ContextMenu into shared component"
```

---

### Task 5: Add Context Menu to MessageGroup

**Files:**
- Modify: `src/components/MessageGroup.tsx`
- Modify: `src/components/MessageList.tsx`

- [ ] **Step 1: Add `onRewind` prop to MessageGroup**

In `src/components/MessageGroup.tsx`, add the prop and attach `onContextMenu` to the outer `<div>`. The signature includes coordinates so ThreadDetail can position the context menu:

Add to the component signature:
```typescript
export default function MessageGroup({
  group,
  agent,
  isUser,
  isStreaming,
  displayName = "You",
  onRewind,
}: {
  // ... existing props ...
  onRewind?: (messageId: string, x: number, y: number) => void;
}) {
```

Wrap the outer `<div>` with `onContextMenu`:
```typescript
const lastMessage = group.messages[group.messages.length - 1];

return (
  <div
    className="border-b border-zinc-100 dark:border-zinc-800 py-2 last:border-b-0"
    onContextMenu={(e) => {
      if (onRewind) {
        e.preventDefault();
        onRewind(lastMessage.id, e.clientX, e.clientY);
      }
    }}
  >
```

The context menu triggers on the last message in the group, which is the most intuitive — "rewind to this group" keeps everything up to and including the group's final message.

- [ ] **Step 2: Pass `onRewind` through MessageList**

In `src/components/MessageList.tsx`, add the prop and forward it:

```typescript
export default function MessageList({
  messages,
  agents,
  displayName,
  onRewind,
}: {
  messages: Message[];
  agents: Agent[];
  displayName?: string;
  onRewind?: (messageId: string, x: number, y: number) => void;
}) {
```

Pass to each `<MessageGroup>`:
```typescript
<MessageGroup
  key={`${group.senderId}-${group.messages[0].id}`}
  group={group}
  agent={agent}
  isUser={isUser}
  isStreaming={isStreaming}
  displayName={displayName}
  onRewind={onRewind}
/>
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/MessageGroup.tsx src/components/MessageList.tsx
git commit -m "feat(rewind): add onRewind prop to MessageGroup and MessageList"
```

---

### Task 6: Wire Up Rewind in ThreadDetail and page.tsx

**Files:**
- Modify: `src/components/ThreadDetail.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add rewind state and UI to ThreadDetail**

In `src/components/ThreadDetail.tsx`:

Add imports:
```typescript
import { RotateCcw } from "lucide-react";
import ContextMenu from "./ContextMenu";
```

Add props:
```typescript
onRewind?: (messageId: string) => void;
```

Add state for the context menu and confirmation dialog:
```typescript
const [rewindMenu, setRewindMenu] = useState<{ x: number; y: number; messageId: string } | null>(null);
const [rewindConfirm, setRewindConfirm] = useState<string | null>(null); // messageId to confirm
```

Add the handler (receives coordinates from MessageGroup via the `onRewind` prop):

```typescript
const handleRewindRequest = useCallback((messageId: string, x: number, y: number) => {
  if (isStreaming) return; // Don't show menu while streaming
  setRewindMenu({ x, y, messageId });
}, [isStreaming]);
```

Pass to MessageList:
```typescript
<MessageList
  messages={allMessages}
  agents={thread.agents}
  displayName={displayName}
  onRewind={handleRewindRequest}
/>
```

Add the ContextMenu and confirmation dialog after `<MessageInput>`:

```typescript
{rewindMenu && (
  <ContextMenu
    x={rewindMenu.x}
    y={rewindMenu.y}
    onClose={() => setRewindMenu(null)}
    items={[
      {
        label: "Rewind to here",
        icon: <RotateCcw className="h-4 w-4" />,
        onClick: () => setRewindConfirm(rewindMenu.messageId),
      },
    ]}
  />
)}
{rewindConfirm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-xl">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Rewind conversation?</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Messages after this point will be permanently deleted.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => setRewindConfirm(null)}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onRewind?.(rewindConfirm);
            setRewindConfirm(null);
          }}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Rewind
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Add `handleRewind` in page.tsx**

In `src/app/page.tsx`:

Add the handler:
```typescript
const handleRewind = useCallback(
  async (messageId: string) => {
    if (!selectedThreadId) return;
    const res = await fetch(wsUrl(`/api/threads/${selectedThreadId}/rewind`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setSelectedThread(updated);
    refetchThreads();
  },
  [selectedThreadId, setSelectedThread, refetchThreads, wsUrl]
);
```

Pass to ThreadDetail:
```typescript
<ThreadDetail
  thread={selectedThread}
  streamingMessages={streamingMessages}
  onSendMessage={handleSendMessage}
  onStop={stopAgent}
  onRenameThread={handleRenameThread}
  onRewind={handleRewind}
  isStreaming={isStreaming}
  allAgents={agents}
  displayName={displayName}
  isMobile={isMobile}
  onBack={isMobile ? () => setSelectedThreadId(null) : undefined}
/>
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Manual test**

1. Start dev server: `npm run dev`
2. Open a thread with at least 3 messages
3. Right-click on the second message — context menu appears with "Rewind to here"
4. Click "Rewind to here" — confirmation dialog appears
5. Click "Rewind" — messages after the second message disappear
6. Send a new message — agent responds (fresh session, with context from remaining messages)
7. Verify: right-click during streaming shows no context menu

- [ ] **Step 5: Commit**

```bash
git add src/components/ThreadDetail.tsx src/components/MessageGroup.tsx src/components/MessageList.tsx src/app/page.tsx
git commit -m "feat(rewind): wire up rewind UI with context menu and confirmation dialog"
```
