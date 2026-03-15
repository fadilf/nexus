# Background Streaming Resilience

**Date:** 2026-03-15
**Status:** Draft

## Problem

When a user sends a message and navigates away (switches threads, reloads the page, or closes and reopens the tab), the streaming response is lost or marked as an error. The user expects to come back and either see the completed message or see that it's still streaming.

## Goals

1. Streaming continues in the background regardless of client state
2. Returning to a thread re-attaches to an active stream or shows the completed message
3. Sidebar indicates which threads have new activity (pulsing dot for streaming, solid dot for unread completed)
4. Works across in-app navigation, full page reloads, and tab close/reopen

## Design

### Section 1: Server-Side Recovery Fix

**Current bug:** `getThread()` in `thread-store.ts` marks any message with `status: "streaming"` as `"error"` on read. This is stale-process recovery logic, but it incorrectly marks messages for processes that are still alive.

**Changes:**

- **`thread-store.ts` — `getThread()`:** Before marking a streaming message as `"error"`, check `ProcessManager.getProcess(threadId, agentId)` to see if the process is still running. If it is, leave `status: "streaming"`.
- **New endpoint — `GET /api/threads/{threadId}/status`:** Lightweight endpoint that returns which agents are currently streaming for a thread. The client calls this on page load / thread switch to decide whether to re-attach.

  Response shape:
  ```json
  {
    "streaming": [
      { "agentId": "agent-1", "messageId": "msg-123" }
    ]
  }
  ```

### Section 2: Client Re-attach on Page Load

**On initial page load or hard refresh:**

1. Client fetches the thread (as it does today).
2. If any messages have `status: "streaming"`, the client calls the existing `POST /api/threads/{threadId}/stream` endpoint for each streaming agent.
3. The stream route detects the process is alive via `ProcessManager.getProcess()`, returns buffered output, and pipes new output (this already works).
4. `useAgentStream` picks up the stream and renders the message as actively streaming.

**On switching threads within the app (no page reload):**

- No change needed. The `allStreams` ref in `useAgentStream` already keeps connections alive across thread switches.

**Key change:** The client must detect `status: "streaming"` messages when loading a thread and auto-initiate re-attach. Currently it only streams when the user explicitly sends a message.

### Section 3: Unread Tracking

**Server-side:**

- Add an `unreadAgents` field to the thread JSON: an array of agent IDs whose messages completed while no client was listening.
- When a stream completes in the API route and the SSE connection has been closed (client navigated away or reloaded), add that agent's ID to `unreadAgents`.
- Extend the existing `PATCH /api/threads/{threadId}` handler to support clearing `unreadAgents` when the client opens the thread.

**Client-side:**

- Thread list fetches include `unreadAgents` for each thread.
- Sidebar shows:
  - **Pulsing dot** — thread has messages with `status: "streaming"` (process still active)
  - **Solid dot** — thread has entries in `unreadAgents` (completed while you were away)
- When user opens a thread, client sends a PATCH to clear `unreadAgents`.

**Why server-side tracking?** Survives page reloads and tab closes. localStorage would lose state if the user clears browser data or uses a different tab.

### Section 4: Client-Side Changes

**ThreadDetail component:**

- On mount (or when `selectedThreadId` changes), check if any messages have `status: "streaming"`.
- If so, automatically call the stream endpoint to re-attach.
- On re-attach, show a brief "Reconnecting..." state on the message bubble while the re-attach handshake happens.

**ThreadList component (sidebar):**

- Each thread item checks two things:
  - Does the thread have any messages with `status: "streaming"`? → pulsing dot
  - Does the thread have `unreadAgents.length > 0`? → solid dot
- Pulsing dot takes precedence over solid dot (if both apply, show pulsing).
- Dots appear next to the thread name, using the agent's color if single agent, or a neutral accent color if multiple.

**useAgentStream hook:**

- Add a `reattach(threadId, agentId)` function that initiates a stream request without sending a new user message.
- On `onStreamComplete`, if the completed thread is not the currently selected thread, update that thread's `unreadAgents` on the server via PATCH.

**Page load flow:**

1. Fetch thread list → render sidebar with dots
2. Fetch selected thread → detect streaming messages → auto re-attach
3. Clear `unreadAgents` for the selected thread

## Data Flow

```
Page Load / Thread Switch
  ├─ GET /api/threads → thread list with unreadAgents
  ├─ GET /api/threads/{id} → thread with message statuses
  │   └─ getThread() checks ProcessManager before marking errors
  ├─ If streaming messages found:
  │   └─ POST /api/threads/{id}/stream (re-attach per agent)
  │       └─ ProcessManager.getProcess() → buffered output + pipe
  └─ PATCH /api/threads/{id} → clear unreadAgents

Stream Completion (server-side)
  ├─ updateMessage(status: "complete")
  ├─ If SSE connection closed (client gone):
  │   └─ Add agentId to thread's unreadAgents
  └─ Send done event (if client still connected)
```

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/thread-store.ts` | Fix `getThread()` recovery logic; add `unreadAgents` field support |
| `src/lib/process-manager.ts` | No changes needed (already supports `getProcess()`) |
| `src/app/api/threads/[threadId]/stream/route.ts` | On stream complete with closed connection, write `unreadAgents` |
| `src/app/api/threads/[threadId]/status/route.ts` | New endpoint: return active streaming agents |
| `src/app/api/threads/[threadId]/route.ts` | Extend PATCH to support clearing `unreadAgents` |
| `src/hooks/useSSE.ts` | Add `reattach()` function |
| `src/app/page.tsx` | Auto re-attach on thread load; clear unread on thread select |
| `src/components/ThreadDetail.tsx` | Show "Reconnecting..." state during re-attach |
| `src/components/ThreadList.tsx` | Render pulsing/solid dots based on streaming/unread state |

## Edge Cases

- **Process crashes while client is away:** `getThread()` correctly marks as "error" (ProcessManager has no entry). No re-attach attempted. User sees error state.
- **Multiple agents streaming:** Each agent tracked independently. Re-attach happens per agent. Unread tracks per agent.
- **Rapid thread switching:** AbortController on re-attach requests prevents stale responses.
- **Thread deleted while streaming:** Process cleanup via existing stop endpoint. Thread removal cleans up naturally.
