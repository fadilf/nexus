# Background Streaming Resilience Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make message streaming resilient to navigation — users can send a message, navigate away (switch threads, reload, close tab), come back, and see the completed response or a live stream.

**Architecture:** Split `getThread()` into read-only + recovery paths, add `reattach()` to the SSE hook, track unread agents server-side per thread, and show pulsing/solid dots in the sidebar.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-15-background-streaming-resilience-design.md`

**No test framework configured** — verification is via `npm run build` (type checking), `npm run lint`, and manual testing.

**Known limitation:** `recoverStaleStreams()` runs for a single workspace directory (from `NEXUS_PROJECT_DIR` or `cwd()`). Multi-workspace recovery would require iterating all known workspaces, which is out of scope for this change.

---

## Chunk 1: Server-Side Foundation

### Task 1: Add `unreadAgents` to types

**Files:**
- Modify: `src/lib/types.ts:17-24` (Thread type)
- Modify: `src/lib/types.ts:52-55` (ThreadListItem type)

- [ ] **Step 1: Add `unreadAgents` to Thread type**

In `src/lib/types.ts`, add `unreadAgents?: string[]` to the `Thread` type after line 23 (`archived`):

```typescript
export type Thread = {
  id: string;
  title: string;
  agents: Agent[];
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  unreadAgents?: string[];  // Add this line
};
```

This automatically applies to `ThreadWithMessages` (line 43: `Thread & { messages: Message[] }`).

- [ ] **Step 2: Add `unreadAgents` to ThreadListItem type**

In `src/lib/types.ts`, the `ThreadListItem` type (line 52) extends `Thread`, so it inherits `unreadAgents` automatically. No change needed here.

- [ ] **Step 3: Run build to verify types compile**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add unreadAgents field to Thread type"
```

---

### Task 2: Make `getThread()` read-only

**Files:**
- Modify: `src/lib/thread-store.ts:69-89`

- [ ] **Step 1: Remove the recovery side effect from `getThread()`**

In `src/lib/thread-store.ts`, the `getThread()` function (lines 69-89) reads a thread from disk, then mutates streaming messages to error status and writes back. Remove lines 73-84 (the entire recovery block). After this change, `getThread()` should just read the file, parse JSON, and return.

Replace the entire function with:

```typescript
export async function getThread(workspaceDir: string, id: string): Promise<ThreadWithMessages | null> {
  try {
    const raw = await readFile(getThreadPath(workspaceDir, id), "utf-8");
    return JSON.parse(raw) as ThreadWithMessages;
  } catch {
    return null;
  }
}
```

This removes:
- The `for (const msg of data.messages)` loop that sets `msg.status = "error"` and appends `"\n\n[Stream interrupted]"`
- The `if (modified)` block that writes back to disk

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/thread-store.ts
git commit -m "refactor: make getThread() read-only, remove recovery side effect"
```

---

### Task 3: Add `recoverStaleStreams()` function

**Files:**
- Modify: `src/lib/thread-store.ts` (add new exported function)
- Modify: `src/lib/process-manager.ts:211-227` (call recovery on singleton init)

- [ ] **Step 1: Add `recoverStaleStreams()` to thread-store.ts**

Add this exported function after the `getThread()` function in `src/lib/thread-store.ts`. It imports `getProcessManager` from `process-manager.ts`:

```typescript
import { getProcessManager } from "./process-manager";

export async function recoverStaleStreams(workspaceDir: string): Promise<void> {
  const threadsDir = getThreadsDir(workspaceDir);
  let files: string[];
  try {
    files = await readdir(threadsDir);
  } catch {
    return; // No threads directory yet
  }

  const pm = getProcessManager();

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const threadId = file.replace(".json", "");

    await withLock(threadId, async () => {
      const threadPath = getThreadPath(workspaceDir, threadId);
      const raw = await readFile(threadPath, "utf-8");
      const thread = JSON.parse(raw) as ThreadWithMessages;

      let modified = false;
      for (const msg of thread.messages) {
        if (msg.status === "streaming") {
          const agentId = msg.agentId || "";
          const existing = pm.getProcess(threadId, agentId);
          if (!existing) {
            msg.status = "error";
            msg.content += "\n\n[Stream interrupted]";
            modified = true;
          }
        }
      }

      if (modified) {
        await writeFile(threadPath, JSON.stringify(thread, null, 2));
      }
    });
  }
}
```

Note: Uses the existing named imports (`readdir`, `readFile`, `writeFile`) already in the file, and the existing `getThreadsDir()`, `getThreadPath()`, `withLock()` helpers.

- [ ] **Step 2: Call `recoverStaleStreams()` from ProcessManager singleton init**

In `src/lib/process-manager.ts`, in the `getProcessManager()` function (lines 211-227), after creating the ProcessManager instance (line 214), call recovery using a **dynamic import** to avoid a circular dependency (`thread-store.ts` already imports from `process-manager.ts`):

```typescript
// Add after line 214 (g[globalKey] = new ProcessManager();):
import("./thread-store").then(({ recoverStaleStreams }) => {
  const workspaceDir = process.env.NEXUS_PROJECT_DIR || process.cwd();
  recoverStaleStreams(workspaceDir).catch((err) => {
    console.error("Failed to recover stale streams:", err);
  });
});
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: No type errors, no circular dependency issues

- [ ] **Step 4: Commit**

```bash
git add src/lib/thread-store.ts src/lib/process-manager.ts
git commit -m "feat: add recoverStaleStreams() with ProcessManager check on startup"
```

---

### Task 4: Add `unreadAgents` support to thread-store operations

**Files:**
- Modify: `src/lib/thread-store.ts`

- [ ] **Step 1: Add `addUnreadAgent()` function**

Add to `src/lib/thread-store.ts` after `recoverStaleStreams()`:

```typescript
export async function addUnreadAgent(
  workspaceDir: string,
  threadId: string,
  agentId: string
): Promise<void> {
  await withLock(threadId, async () => {
    const threadPath = getThreadPath(workspaceDir, threadId);
    const raw = await readFile(threadPath, "utf-8");
    const thread = JSON.parse(raw) as ThreadWithMessages;

    const unreadAgents = thread.unreadAgents || [];
    if (!unreadAgents.includes(agentId)) {
      thread.unreadAgents = [...unreadAgents, agentId];
      await writeFile(threadPath, JSON.stringify(thread, null, 2));
    }
  });
}
```

- [ ] **Step 2: Add `clearUnreadAgents()` function**

Add to `src/lib/thread-store.ts`:

```typescript
export async function clearUnreadAgents(
  workspaceDir: string,
  threadId: string
): Promise<void> {
  await withLock(threadId, async () => {
    const threadPath = getThreadPath(workspaceDir, threadId);
    const raw = await readFile(threadPath, "utf-8");
    const thread = JSON.parse(raw) as ThreadWithMessages;

    if (thread.unreadAgents && thread.unreadAgents.length > 0) {
      thread.unreadAgents = [];
      await writeFile(threadPath, JSON.stringify(thread, null, 2));
    }
  });
}
```

- [ ] **Step 3: Update `listThreads()` to include `unreadAgents`**

In `src/lib/thread-store.ts`, in the `listThreads()` function, add `unreadAgents` to the object pushed into `items` (around line 50-59). Add after `archived: data.archived,` (line 56):

```typescript
items.push({
  id: data.id,
  title: data.title,
  agents: data.agents,
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
  archived: data.archived,
  unreadAgents: data.unreadAgents || [],  // Add this line
  lastMessagePreview: lastMsg?.content?.slice(0, 100) ?? "",
  messageCount: messages.length,
});
```

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/thread-store.ts
git commit -m "feat: add addUnreadAgent/clearUnreadAgents and include unreadAgents in listThreads"
```

---

### Task 5: Extend PATCH endpoint to support clearing unreadAgents

**Files:**
- Modify: `src/app/api/threads/[threadId]/route.ts:19-43`

- [ ] **Step 1: Add `clearUnread` handling to PATCH**

In `src/app/api/threads/[threadId]/route.ts`, add an import for `clearUnreadAgents` and a new branch **before** the existing `body.archived` check (line 27). This placement is critical — if placed after the title validation (line 35), `clearUnread` requests would hit the 400 error.

Add import:
```typescript
import { getThread, deleteThread, updateThreadTitle, archiveThread, clearUnreadAgents } from "@/lib/thread-store";
```

Add branch before line 27:
```typescript
  if (body.clearUnread === true) {
    await clearUnreadAgents(workspaceDir, threadId);
    return NextResponse.json({ success: true });
  }
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/threads/[threadId]/route.ts
git commit -m "feat: extend PATCH endpoint to support clearing unreadAgents"
```

---

### Task 6: Extend status endpoint to include unreadAgents

**Files:**
- Modify: `src/app/api/threads/status/route.ts` (full rewrite — currently 7 lines)

- [ ] **Step 1: Rewrite status endpoint to include unreadAgents**

Replace `src/app/api/threads/status/route.ts` entirely:

```typescript
import { NextResponse } from "next/server";
import { getProcessManager } from "@/lib/process-manager";
import { listThreads } from "@/lib/thread-store";
import { resolveWorkspaceDir } from "@/lib/workspace-context";

export async function GET(request: Request) {
  const pm = getProcessManager();
  const statuses = pm.getAllStatuses();

  const workspaceDir = await resolveWorkspaceDir(request);
  const threads = await listThreads(workspaceDir);

  const unreadByThread: Record<string, string[]> = {};
  for (const t of threads) {
    if (t.unreadAgents && t.unreadAgents.length > 0) {
      unreadByThread[t.id] = t.unreadAgents;
    }
  }

  return NextResponse.json({ statuses, unreadByThread });
}
```

Note: The function signature changes from `GET()` to `GET(request: Request)` to access workspace context. `resolveWorkspaceDir` is imported from `@/lib/workspace-context` (not `@/lib/context`), and it takes a `Request` object (not `URLSearchParams`), and it's async.

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/threads/status/route.ts
git commit -m "feat: include unreadAgents per thread in status endpoint"
```

---

## Chunk 2: Stream Route Changes

### Task 7: Add `initial` event type and unread tracking to stream route

**Files:**
- Modify: `src/app/api/threads/[threadId]/stream/route.ts`

- [ ] **Step 1: Add import for `addUnreadAgent`**

In `src/app/api/threads/[threadId]/stream/route.ts`, update the thread-store import (line 2):

```typescript
import { getThread, addMessage, updateMessage, addUnreadAgent } from "@/lib/thread-store";
```

- [ ] **Step 1.5: Add empty-prompt guard after re-attach check**

After the re-attach path (after line 89's closing brace), add a guard so that an empty prompt (from a re-attach request where the process already finished) doesn't spawn a new CLI process:

```typescript
  // Guard: empty prompt with no running process means stale re-attach attempt
  if (!prompt) {
    return NextResponse.json(
      { error: "Process no longer running" },
      { status: 410 }
    );
  }
```

This goes between the re-attach block (ending line 89) and the "Create assistant message placeholder" section (line 91). The `reattach()` client function should handle a non-OK response gracefully (it already does via the `if (!res.ok || !res.body)` check).

- [ ] **Step 2: Add `initial` event on re-attach path**

In the re-attach path (lines 41-89), after line 46 (`const encoder = new TextEncoder();`), before the buffer replay loop (line 48), send the persisted message content as an `initial` event and **skip** the buffer replay. The `thread` variable is already available from line 18.

The buffer contains ALL raw CLI output since process start (not just since last persist), so replaying it through the parser would produce content that overlaps with the persisted text. Instead, send the persisted content and only pipe future live output.

Replace the buffer replay loop (lines 48-55) and the live pipe section with:

```typescript
        // Send persisted content as initial event (instead of replaying buffer)
        const streamingMsg = thread.messages.find(
          (m) => m.agentId === agentId && m.status === "streaming"
        );
        if (streamingMsg && streamingMsg.content) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "initial", content: streamingMsg.content })}\n\n`)
          );
        }

        // Pipe only future output (skip buffer — persisted content covers it)
```

Keep the existing live pipe (`existing.process.stdout?.on("data", ...)`) and close handler unchanged after this.

- [ ] **Step 3: Track client disconnect in re-attach path for unread marking**

In the re-attach path's `start(controller)` block, add disconnect tracking. Add at the beginning of `start()` (after `const encoder`):

```typescript
        let clientDisconnected = false;
        request.signal.addEventListener("abort", () => {
          clientDisconnected = true;
        });
```

Then in the `existing.process.on("close", ...)` handler (line 71), add unread marking after the `controller.enqueue` for the "done" event:

```typescript
        existing.process.on("close", (code) => {
          const status = code === 0 ? "complete" : "error";
          if (clientDisconnected && status === "complete") {
            addUnreadAgent(workspaceDir, threadId, agentId).catch(() => {});
          }
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", status })}\n\n`));
            controller.close();
          } catch {
            // Already closed
          }
        });
```

- [ ] **Step 4: Track client disconnect in new-process path for unread marking**

In the new-process path (lines 111-197), add the same disconnect tracking at the beginning of the `start(controller)` block (after line 113 `const encoder`):

```typescript
        let clientDisconnected = false;
        request.signal.addEventListener("abort", () => {
          clientDisconnected = true;
        });
```

Then in the `onClose` callback (line 152), add unread marking before the existing `updateMessage` call:

```typescript
          // onClose
          (code) => {
            const status = code === 0 ? "complete" : "error";
            if (clientDisconnected && status === "complete") {
              addUnreadAgent(workspaceDir, threadId, agentId).catch(() => {});
            }
            updateMessage(workspaceDir, threadId, assistantMsg.id, {
              // ... rest unchanged
```

- [ ] **Step 5: Run build to verify**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/threads/[threadId]/stream/route.ts
git commit -m "feat: send initial event on re-attach, track client disconnect for unread"
```

---

## Chunk 3: Client-Side Hook Changes

### Task 8: Add `reattach()` to useAgentStream hook

**Files:**
- Modify: `src/hooks/useSSE.ts`

- [ ] **Step 1: Add `reattach()` function**

In `src/hooks/useSSE.ts`, add a `reattach` function inside the `useAgentStream` hook, after `stopAgent` (line 164). This reuses the same streaming infrastructure as `streamAgent` but handles the `initial` event type and doesn't create a new streaming entry if one already exists in the allStreams map:

```typescript
  const reattach = useCallback(
    async (reattachThreadId: string, agentId: string) => {
      const controllerKey = `${reattachThreadId}:${agentId}`;

      // Don't re-attach if already streaming this agent
      if (abortControllers.current.has(controllerKey)) return;

      const controller = new AbortController();
      abortControllers.current.set(controllerKey, controller);

      // Initialize streaming entry
      if (!allStreams.current.has(reattachThreadId)) {
        allStreams.current.set(reattachThreadId, new Map());
      }
      allStreams.current
        .get(reattachThreadId)!
        .set(agentId, { agentId, content: "" });
      triggerRender();

      try {
        const res = await fetch(
          `/api/threads/${reattachThreadId}/stream${wsParam()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId, prompt: "" }),
            signal: controller.signal,
          }
        );

        if (!res.ok || !res.body) {
          throw new Error(`Re-attach failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "initial") {
                // Set (not append) persisted content
                const threadStreams = allStreams.current.get(reattachThreadId);
                if (threadStreams) {
                  threadStreams.set(agentId, { agentId, content: event.content });
                  triggerRender();
                }
              } else if (event.type === "content") {
                const threadStreams = allStreams.current.get(reattachThreadId);
                if (threadStreams) {
                  const existing = threadStreams.get(agentId);
                  threadStreams.set(agentId, {
                    agentId,
                    content: (existing?.content ?? "") + event.text,
                  });
                  triggerRender();
                }
              } else if (event.type === "done") {
                break;
              } else if (event.type === "error") {
                setError(event.message);
              }
            } catch {
              // Not valid JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Re-attach failed:", err);
        }
      } finally {
        abortControllers.current.delete(controllerKey);
        const threadStreams = allStreams.current.get(reattachThreadId);
        if (threadStreams) {
          threadStreams.delete(agentId);
          if (threadStreams.size === 0) {
            allStreams.current.delete(reattachThreadId);
            onCompleteRef.current?.(reattachThreadId);
          }
        }
        triggerRender();
      }
    },
    [triggerRender, wsParam]
  );
```

- [ ] **Step 2: Add `reattach` to the hook's return value**

Update the return statement (lines 166-172) to include `reattach`:

```typescript
  return {
    streamingMessages,
    isStreaming,
    error,
    sendMessage,
    stopAgent,
    reattach,
  };
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSSE.ts
git commit -m "feat: add reattach() function to useAgentStream hook"
```

---

## Chunk 4: Client-Side UI Changes

### Task 9: Auto re-attach and unread clearing in page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Destructure `reattach` from the hook**

In `src/app/page.tsx`, update the destructuring on line 156:

```typescript
  const { streamingMessages, isStreaming, sendMessage, stopAgent, reattach } = useAgentStream(
    selectedThreadId,
    handleStreamComplete,
    activeWorkspaceId
  );
```

- [ ] **Step 2: Auto re-attach when loading a thread with streaming messages**

Add a `useEffect` after the existing `useEffect` for `streamCompleteThreadId` (after line 171):

```typescript
  // Auto re-attach to streams that were in progress when we navigated away
  useEffect(() => {
    if (!selectedThread) return;

    const pendingStreams = selectedThread.messages.filter(
      (m) => m.status === "streaming" && m.agentId
    );

    for (const msg of pendingStreams) {
      reattach(selectedThread.id, msg.agentId!);
    }
  }, [selectedThread?.id, reattach]);
```

Note: Uses `selectedThread?.id` as dependency (not `selectedThread`) to avoid re-running on every message update. Uses `pendingStreams` to avoid naming collision with `streamingMessages` from the hook.

- [ ] **Step 3: Clear unreadAgents when selecting a thread**

Add a `useEffect` that PATCHes `clearUnread` when a thread is selected:

```typescript
  // Clear unread indicators when opening a thread
  useEffect(() => {
    if (!selectedThreadId) return;
    fetch(wsUrl(`/api/threads/${selectedThreadId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearUnread: true }),
    }).catch(() => {});
  }, [selectedThreadId, wsUrl]);
```

- [ ] **Step 4: Add `unreadByThread` state and update status polling**

Add state for unread tracking (after `statuses` state on line 55):

```typescript
  const [unreadByThread, setUnreadByThread] = useState<Record<string, string[]>>({});
```

Update the status polling effect (lines 174-184) to parse the new response shape:

```typescript
  // Poll statuses
  useEffect(() => {
    const poll = () => {
      fetch(wsUrl("/api/threads/status"))
        .then((r) => r.json())
        .then((data) => {
          setStatuses(data.statuses ?? data);
          setUnreadByThread(data.unreadByThread ?? {});
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, [wsUrl]);
```

Note: Also changed the URL to use `wsUrl()` for workspace support (the current code polls without workspace context).

- [ ] **Step 5: Pass `unreadByThread` to ThreadList**

Update the `threadListEl` JSX (around line 292) to pass the new prop:

```tsx
  const threadListEl = (
    <ThreadList
      threads={threadList}
      selectedThreadId={selectedThreadId}
      onSelectThread={setSelectedThreadId}
      onNewThread={() => setShowNewThread(true)}
      onOpenSettings={() => setShowSettings(true)}
      onArchiveThread={handleArchiveThread}
      statuses={statuses}
      unreadByThread={unreadByThread}
      isMobile={isMobile}
    />
  );
```

- [ ] **Step 6: Run build to verify**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: auto re-attach on thread load, clear unread on select, parse new status shape"
```

---

### Task 10: Add unread indicators to ThreadList

**Files:**
- Modify: `src/components/ThreadList.tsx`

- [ ] **Step 1: Accept `unreadByThread` prop in ThreadList**

Update the `ThreadList` component props (lines 193-211) to include `unreadByThread`:

```typescript
export default function ThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
  onOpenSettings,
  onArchiveThread,
  statuses,
  unreadByThread,
  isMobile,
}: {
  threads: ThreadListItem[];
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onOpenSettings: () => void;
  onArchiveThread: (threadId: string, archived: boolean) => void;
  statuses: ThreadProcess[];
  unreadByThread?: Record<string, string[]>;
  isMobile?: boolean;
}) {
```

- [ ] **Step 2: Pass `unreadByThread` to ThreadItem**

Update the `ThreadItem` component to accept and use `unreadByThread`. Add the prop:

```typescript
function ThreadItem({
  thread,
  isSelected,
  statuses,
  unreadByThread,
  onSelect,
  onContextMenu,
  onOverflowMenu,
  isMobile,
}: {
  thread: ThreadListItem;
  isSelected: boolean;
  statuses: ThreadProcess[];
  unreadByThread?: Record<string, string[]>;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onOverflowMenu?: (e: React.MouseEvent) => void;
  isMobile?: boolean;
}) {
```

Pass it from `ThreadList` to `ThreadItem` in both the active and archived thread renders (lines 254, 279):

```tsx
<ThreadItem
  key={thread.id}
  thread={thread}
  isSelected={thread.id === selectedThreadId}
  statuses={statuses}
  unreadByThread={unreadByThread}
  onSelect={() => onSelectThread(thread.id)}
  onContextMenu={(e) => handleContextMenu(e, thread)}
  onOverflowMenu={(e) => handleContextMenu(e, thread)}
  isMobile={isMobile}
/>
```

- [ ] **Step 3: Add pulsing/solid dot indicators to ThreadItem**

Inside the `ThreadItem` component, compute unread state after the existing `hasRunning`/`hasError` checks (line 84-85):

```typescript
  const unreadAgents = unreadByThread?.[thread.id];
  const hasUnread = unreadAgents && unreadAgents.length > 0;
```

Then add the dot indicator inside the title row's right-side `div` (line 153), before the `AgentStatusBadge`:

```tsx
          <div className="flex shrink-0 items-center gap-1.5">
            {hasRunning && (
              <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
            )}
            {!hasRunning && hasUnread && (
              <span className="h-2 w-2 rounded-full bg-violet-500" />
            )}
            {(hasRunning || hasError) && (
              <AgentStatusBadge status={hasRunning ? "running" : "error"} />
            )}
            <span className="text-[11px] text-zinc-500">
              {formatDate(thread.updatedAt)}
            </span>
          </div>
```

The pulsing dot (`animate-pulse`) for streaming takes visual precedence — it only shows when `hasRunning` is true. The solid dot shows when `hasUnread` is true and nothing is running.

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ThreadList.tsx
git commit -m "feat: add pulsing/solid unread dots to thread list items"
```

---

### Task 11: Show "Reconnecting..." state in MessageBubble

**Files:**
- Modify: `src/components/MessageBubble.tsx:154-162`

- [ ] **Step 1: Add reconnecting visual state**

In `src/components/MessageBubble.tsx`, the streaming section (lines 158-162) shows a pulsing dot. Add a "Reconnecting..." label when the message is streaming but has no content yet (which happens during the re-attach handshake before the `initial` event arrives).

Replace lines 154-162:

```tsx
              {message.content || (isStreaming ? "" : "")}
            </ReactMarkdown>
          </div>
        )}
        {isStreaming && !message.content && (
          <span className="text-xs text-zinc-400 italic">Reconnecting...</span>
        )}
        {isStreaming && (
          <span className="inline-flex ml-1">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-500" />
          </span>
        )}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/MessageBubble.tsx
git commit -m "feat: show Reconnecting state during stream re-attach"
```

---

## Chunk 5: Integration and Verification

### Task 12: Final build and manual verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Clean build with no errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 3: Manual test — in-app thread switching**

1. Start dev server: `npm run dev`
2. Create a thread, send a message that will take a while to respond
3. While streaming, click a different thread
4. Wait a few seconds, click back to the original thread
5. Verify: message is still streaming (or completed) — NOT marked as error

- [ ] **Step 4: Manual test — page reload**

1. Send a message in a thread
2. While streaming, reload the page (Cmd+R)
3. Select the same thread
4. Verify: message re-attaches and shows content, or shows completed if finished

- [ ] **Step 5: Manual test — unread indicators**

1. Send a message in thread A
2. Switch to thread B while thread A is still streaming
3. Verify: thread A shows a pulsing dot in the sidebar
4. Wait for thread A's stream to complete
5. Verify: thread A shows a solid dot in the sidebar
6. Click thread A
7. Verify: dot disappears after opening

- [ ] **Step 6: Manual test — close and reopen tab**

1. Send a message in a thread
2. Close the tab while streaming
3. Reopen the app
4. Navigate to the thread
5. Verify: message shows with content (either streaming or completed), NOT error

- [ ] **Step 7: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: integration fixes from manual testing"
```
