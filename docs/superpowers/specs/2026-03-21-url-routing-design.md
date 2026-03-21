# URL-Based Routing for Workspaces & Threads

**Date:** 2026-03-21
**Status:** Draft

## Problem

Entourage is a single-page app with no URL-based routing. Workspace and thread selection are purely client-side state (React `useState` + localStorage). This means:

- No browser back/forward navigation between threads or workspaces
- No bookmarkable URLs for specific conversations
- No multi-tab support — opening a new tab always starts from the last-used workspace with no thread selected
- URL never changes regardless of what the user is looking at

## Goals

- **Navigation UX:** Browser back/forward buttons work naturally between workspaces and threads. URLs are bookmarkable. Refresh restores the exact view.
- **Multi-tab support:** Users can open different threads in separate browser tabs, each with its own URL. Tabs with active streams re-attach to the stream.

## Non-Goals

- Shareability / collaboration (single-user tool)
- SSR / server-side data fetching (client-side data loading is fine)
- Changing API routes (they already use `?workspaceId=` query params and are unaffected)

## URL Scheme

```
/                              → auto-select last workspace, replace URL to /w/{id}
/w/{workspaceId}               → workspace selected, no thread (thread list + empty detail)
/w/{workspaceId}/{threadId}    → workspace + thread selected (thread list + thread detail)
```

Compact `/w/` prefix keeps URLs short.

## File Structure

```
src/app/
├── layout.tsx                          (unchanged — fonts, Providers)
├── page.tsx                            (redirect to /w/{lastWorkspaceId})
└── w/
    └── [workspaceId]/
        ├── layout.tsx                  (workspace-scoped state & UI shell)
        ├── page.tsx                    (no thread selected — empty detail area)
        └── [threadId]/
            └── page.tsx               (thread selected — thread detail with streaming)
```

## State Decomposition

The current monolithic `Home` component (~718 lines) is decomposed into three layers:

### Root Page (`/app/page.tsx`)

Thin client component. On mount:
1. Read `entourage-active-workspace` from localStorage
2. Fetch `/api/workspaces` to validate the saved ID
3. `router.replace('/w/{validWorkspaceId}')` (or first workspace if saved is invalid)
4. If no workspaces exist, show `AddWorkspaceDialog` inline (same as today)

### Workspace Layout (`/app/w/[workspaceId]/layout.tsx`)

Client component. Route params are accessed via `useParams()` from `next/navigation` (which returns synchronous values in client components). Owns all workspace-scoped state:

| State | Source |
|-------|--------|
| `workspaces`, `setWorkspaces` | Fetched from `/api/workspaces` |
| `activeWorkspaceId` | From URL route param `[workspaceId]` — **not** React state |
| `config`, `agents`, `displayName`, `quickRepliesEnabled` | Fetched from `/api/config` |
| `enabledPlugins` | Derived from config |
| `threads`, `refetchThreads` | Fetched from `/api/threads?workspaceId={id}` |
| `statuses`, `unreadByThread` | Polled from `/api/threads/status` every 2.5s |
| `sidebarWidth` | localStorage-persisted |
| `gitChangeCount`, `gitIsRepo` | Polled from `/api/git/status` every 5s |
| Dialog open states | `showNewThread`, `showSettings`, `showAddWorkspace`, etc. |
| Workspace CRUD handlers | `handleRemoveWorkspace`, `handleEditWorkspace`, etc. |

Renders the fixed UI shell:
- `WorkspaceBar` (always visible on desktop)
- `ThreadList` sidebar (always visible on desktop, resizable)
- Dialogs (`NewThreadDialog`, `SettingsDialog`, `AddWorkspaceDialog`, `GitDialog`, `FileBrowserDialog`, `TerminalDialog`)
- `MobileMenuDrawer` (mobile only)
- `{children}` slot for the main content area

Provides state to children via a new **`WorkspaceLayoutContext`**:
```typescript
interface WorkspaceLayoutContextValue {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeWorkspace: Workspace | undefined;
  threads: ThreadListItem[];
  refetchThreads: () => void;
  agents: Agent[];
  displayName: string;
  quickRepliesEnabled: boolean;
  wsUrl: (path: string) => string;
  statuses: ThreadProcess[];
  unreadByThread: Record<string, string[]>;
  // Dialog openers, workspace handlers, etc.
}
```

**Workspace switching:** `handleSelectWorkspace` calls `router.push('/w/{newId}')`. Since the layout is keyed by `[workspaceId]`, Next.js re-renders with the new workspace context.

**localStorage persistence:** On mount (and when `workspaceId` changes), writes `workspaceId` to `localStorage('entourage-active-workspace')` so the root redirect always knows the last-used workspace.

**WorkspaceProvider:** The existing `WorkspaceProvider` (from `WorkspaceContext.tsx`) is rendered inside this layout, wrapping `{children}`. It receives `workspaceId` from the route param. This keeps `useWorkspaceId()` and `useWsParam()` working unchanged for any component that needs the workspace ID for API URL construction.

**Validation:** If `[workspaceId]` doesn't match any workspace, redirect to `/`.

### Workspace Page (`/app/w/[workspaceId]/page.tsx`)

Minimal component. Renders the "no thread selected" empty state for the main content area. On mobile, this view shows the thread list (since there's no thread to display).

### Thread Page (`/app/w/[workspaceId]/[threadId]/page.tsx`)

Client component. Owns all thread-specific state:

| State | Source |
|-------|--------|
| `selectedThread` | Fetched via `useFetch` from `/api/threads/{threadId}?workspaceId={id}`. Uses `setData` from `useFetch` for optimistic updates (rename, permission change, rewind, message append). |
| `streamingMessages`, `isStreaming`, `sendMessage`, `stopAgent`, `reattach` | `useAgentStream` hook |
| `suggestions` | Quick reply suggestions |
| `effectivePermissionLevel` | Thread override > workspace default |

Renders `ThreadDetail` with all its props. Accesses workspace-level data (agents, threads list, wsUrl, etc.) from `WorkspaceLayoutContext`.

**Stream ownership:** `useAgentStream` lives in this page, scoped to the current `threadId`. When navigating between threads, the hook unmounts and remounts. This is acceptable because:
- The ProcessManager on the server keeps streams alive regardless of client state
- When navigating back to a thread with an active stream, the re-attach mechanism reconnects to it
- This matches the existing behavior where `useAgentStream` is parameterized by `selectedThreadId` and re-initializes when it changes

**Stream re-attach:** When this page mounts (e.g., new tab navigating to a thread URL, or navigating back to a thread), it checks for `status: "streaming"` messages and calls `reattach()` — same as today's behavior.

**Validation:** If the thread fetch returns 404, redirect to `/w/{workspaceId}`. Network errors show an error state (not a redirect) to allow retry.

**Attached threads:** `workspaceThreads` is available from `WorkspaceLayoutContext` (the `threads` field), so `ThreadDetail` can access the thread list for the attachment picker without prop drilling.

## Navigation Behavior

### Thread selection
- Click thread in sidebar → `router.push('/w/{workspaceId}/{threadId}')`
- Thread detail mounts, fetches thread data, re-attaches to active streams

### Thread creation
- `NewThreadDialog` creates thread → `router.push('/w/{workspaceId}/{newThreadId}')` immediately

### Thread archiving
- Archive selected thread → `router.push('/w/{workspaceId}')` (deselect)

### Browser back/forward
- Back from `/w/{wId}/{tId}` to `/w/{wId}` → deselects thread (shows empty detail)
- Back from `/w/{wId}` to `/w/{prevWId}` → switches workspace
- All handled natively by Next.js router

### Mobile
- `/w/{workspaceId}` → shows thread list (full screen)
- `/w/{workspaceId}/{threadId}` → shows thread detail (full screen)
- Back button calls `router.back()` for natural browser history behavior (avoids infinite forward/back loops that `router.push` would create)

### Tab title
Tab titles are set client-side via `document.title` in `useEffect` (since these are client components, not server components with `metadata` exports):
- `/w/{wId}` → `"{workspaceName} | Entourage"` (set in workspace layout)
- `/w/{wId}/{tId}` → `"{threadTitle} — {workspaceName} | Entourage"` (set in thread page)

### Invalid URLs
- Invalid `workspaceId` → redirect to `/` (re-selects last valid workspace)
- Invalid `threadId` → redirect to `/w/{workspaceId}` (deselects thread)

## What Changes

| Area | Change |
|------|--------|
| `src/app/page.tsx` | Replaced with thin redirect component |
| `src/app/w/[workspaceId]/layout.tsx` | **New** — workspace state & UI shell |
| `src/app/w/[workspaceId]/page.tsx` | **New** — empty thread detail state |
| `src/app/w/[workspaceId]/[threadId]/page.tsx` | **New** — thread detail with streaming |
| `src/contexts/WorkspaceContext.tsx` | Unchanged — still provides `workspaceId` for API URLs |
| `WorkspaceLayoutContext` | **New** — provides workspace-level state to child pages |
| `useFetch` hook | Extracted to its own file (`src/hooks/useFetch.ts`) |

## What Stays the Same

- All API routes — unchanged (still use `?workspaceId=` query param)
- All components (`ThreadList`, `ThreadDetail`, `WorkspaceBar`, dialogs) — unchanged
- All hooks (`useAgentStream`, `useIsMobile`, `useVoiceInput`) — unchanged
- `WorkspaceContext` — unchanged
- File-based persistence, ProcessManager, thread store — unchanged
- `useFetch` hook — unchanged (just moved to its own file)

## Migration Steps

1. Extract `useFetch` to `src/hooks/useFetch.ts`
2. Create `WorkspaceLayoutContext` in `src/contexts/WorkspaceLayoutContext.tsx`
3. Build `src/app/w/[workspaceId]/layout.tsx` — workspace state + UI shell
4. Build `src/app/w/[workspaceId]/page.tsx` — empty detail state
5. Build `src/app/w/[workspaceId]/[threadId]/page.tsx` — thread detail
6. Convert root `src/app/page.tsx` to redirect logic
7. Update navigation callbacks passed to components: the prop signatures of `ThreadList`, `WorkspaceBar`, `NewThreadDialog`, etc. stay the same (e.g., `onSelectThread`, `onSelectWorkspace`), but the callback implementations change from `setSelectedThreadId(id)` to `router.push('/w/...')` and `setActiveWorkspaceId(id)` to `router.push('/w/...')`
8. Verify back/forward navigation, multi-tab, stream re-attach
