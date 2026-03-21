# URL-Based Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add URL-based routing so workspace and thread selection are reflected in the browser URL (`/w/{workspaceId}/{threadId}`), enabling back/forward navigation, bookmarkable URLs, and multi-tab support.

**Architecture:** Decompose the monolithic `src/app/page.tsx` into Next.js dynamic route segments: a workspace layout at `/w/[workspaceId]/layout.tsx`, a workspace page, and a thread page. Shared workspace state is provided via a new `WorkspaceLayoutContext`. Navigation uses `router.push`/`router.back` instead of `setState`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `next/navigation` (`useParams`, `useRouter`)

**Spec:** `docs/superpowers/specs/2026-03-21-url-routing-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/hooks/useFetch.ts` | Create | Extract `useFetch` hook from `page.tsx` |
| `src/contexts/WorkspaceLayoutContext.tsx` | Create | Context providing workspace-level state to child routes |
| `src/app/w/[workspaceId]/layout.tsx` | Create | Workspace-scoped state, UI shell (sidebar, workspace bar, dialogs) |
| `src/app/w/[workspaceId]/page.tsx` | Create | Empty thread detail state |
| `src/app/w/[workspaceId]/[threadId]/page.tsx` | Create | Thread detail with streaming, suggestions, permissions |
| `src/app/page.tsx` | Rewrite | Thin redirect to `/w/{lastWorkspaceId}` |
| `src/contexts/WorkspaceContext.tsx` | Unchanged | Still provides `workspaceId` for API URL helpers |

---

### Task 1: Extract `useFetch` Hook

**Files:**
- Create: `src/hooks/useFetch.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/hooks/useFetch.ts`**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useFetch<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      return;
    }
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setError(null);
    fetch(url, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((d) => { if (!ac.signal.aborted) setData(d); })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  const refetch = useCallback(() => {
    if (!url) return;
    setError(null);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then(setData)
      .catch((err) => {
        if (err instanceof Error) setError(err.message);
      });
  }, [url]);

  return [data, setData, refetch, error] as const;
}
```

- [ ] **Step 2: Update `src/app/page.tsx` to import from new location**

Replace the inline `useFetch` function definition (lines 20-65) with:
```typescript
import { useFetch } from "@/hooks/useFetch";
```

Delete the `function useFetch<T>(...) { ... }` block entirely.

- [ ] **Step 3: Verify the app still works**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useFetch.ts src/app/page.tsx
git commit -m "refactor: extract useFetch hook to its own file"
```

---

### Task 2: Create `WorkspaceLayoutContext`

**Files:**
- Create: `src/contexts/WorkspaceLayoutContext.tsx`

- [ ] **Step 1: Create the context file**

```typescript
"use client";

import { createContext, useContext } from "react";
import { ThreadListItem, ThreadProcess, Agent, Workspace, Icon, PermissionLevel } from "@/lib/types";

export interface WorkspaceLayoutContextValue {
  // Workspace data
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeWorkspace: Workspace | undefined;

  // Thread list
  threads: ThreadListItem[];
  refetchThreads: () => void;

  // Config
  agents: Agent[];
  displayName: string;
  quickRepliesEnabled: boolean;
  refetchConfig: () => void;

  // Status polling
  statuses: ThreadProcess[];
  unreadByThread: Record<string, string[]>;

  // API URL helper
  wsUrl: (path: string) => string;

  // Navigation
  navigateToThread: (threadId: string) => void;
  navigateToWorkspace: () => void;

  // Dialogs
  openNewThread: () => void;

  // Workspace CRUD
  handleRemoveWorkspace: (id: string) => Promise<void>;
  handleEditWorkspace: (id: string, updates: { name?: string; color?: string; icon?: Icon | null }) => Promise<void>;
  handleReorderWorkspaces: (orderedIds: string[]) => Promise<void>;
  handleSelectWorkspace: (id: string) => void;
  openAddWorkspace: () => void;
  openSettings: () => void;

  // Plugins
  enabledPlugins: string[];
  handlePluginClick: (pluginId: string) => void;
  gitChangeCount: number;
  gitIsRepo: boolean;

  // Mobile
  isMobile: boolean;
  openMobileMenu: () => void;
}

const WorkspaceLayoutContext = createContext<WorkspaceLayoutContextValue | null>(null);

export function WorkspaceLayoutProvider({
  value,
  children,
}: {
  value: WorkspaceLayoutContextValue;
  children: React.ReactNode;
}) {
  return <WorkspaceLayoutContext value={value}>{children}</WorkspaceLayoutContext>;
}

export function useWorkspaceLayout(): WorkspaceLayoutContextValue {
  const ctx = useContext(WorkspaceLayoutContext);
  if (!ctx) throw new Error("useWorkspaceLayout must be used within WorkspaceLayoutProvider");
  return ctx;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: Build succeeds (context is created but not yet used).

- [ ] **Step 3: Commit**

```bash
git add src/contexts/WorkspaceLayoutContext.tsx
git commit -m "feat: add WorkspaceLayoutContext for URL routing"
```

---

### Task 3: Build the Workspace Layout

This is the largest task. It moves workspace-scoped state and the UI shell from `page.tsx` into the new layout.

**Files:**
- Create: `src/app/w/[workspaceId]/layout.tsx`

- [ ] **Step 1: Create the workspace layout**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ThreadListItem, ThreadWithMessages, ThreadProcess, Agent, Workspace, Icon } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { useIsMobile } from "@/hooks/useIsMobile";
import ThreadList from "@/components/ThreadList";
import NewThreadDialog from "@/components/NewThreadDialog";
import SettingsDialog from "@/components/SettingsDialog";
import WorkspaceBar from "@/components/WorkspaceBar";
import AddWorkspaceDialog from "@/components/AddWorkspaceDialog";
import GitDialog from "@/components/GitDialog";
import FileBrowserDialog from "@/components/FileBrowserDialog";
import TerminalDialog from "@/components/TerminalDialog";
import MobileMenuDrawer from "@/components/MobileMenuDrawer";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { WorkspaceLayoutProvider, WorkspaceLayoutContextValue } from "@/contexts/WorkspaceLayoutContext";
import { PLUGINS } from "@/lib/plugins";

const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 600;
const SIDEBAR_DEFAULT = 320;

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ workspaceId: string; threadId?: string }>();
  const workspaceId = params.workspaceId;
  const selectedThreadId = params.threadId ?? null;
  const router = useRouter();
  const isMobile = useIsMobile();

  // Workspace state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoaded, setWorkspacesLoaded] = useState(false);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGitDialog, setShowGitDialog] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [enabledPlugins, setEnabledPlugins] = useState<string[]>([]);
  const [gitChangeCount, setGitChangeCount] = useState(0);
  const [gitIsRepo, setGitIsRepo] = useState(true);
  const [statuses, setStatuses] = useState<ThreadProcess[]>([]);
  const [unreadByThread, setUnreadByThread] = useState<Record<string, string[]>>({});

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const isResizing = useRef(false);

  // wsUrl helper — workspaceId is always defined in this layout
  const wsUrl = useCallback(
    (path: string) => {
      const separator = path.includes("?") ? "&" : "?";
      return `${path}${separator}workspaceId=${workspaceId}`;
    },
    [workspaceId]
  );

  // Load workspaces on mount
  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((ws: Workspace[]) => {
        setWorkspaces(ws);
        // Validate workspaceId from URL
        if (!ws.find((w) => w.id === workspaceId)) {
          router.replace("/");
          return;
        }
        setWorkspacesLoaded(true);
      })
      .catch(() => {
        setWorkspacesLoaded(true);
      });
  }, [workspaceId, router]);

  // Persist active workspace to localStorage
  useEffect(() => {
    localStorage.setItem("entourage-active-workspace", workspaceId);
  }, [workspaceId]);

  // Sidebar width persistence
  useLayoutEffect(() => {
    const saved = localStorage.getItem("entourage-sidebar-width");
    if (saved) setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Number(saved))));
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + e.clientX - startX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("entourage-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  // Config
  const [config, , refetchConfig] = useFetch<{ agents: Agent[]; displayName?: string; quickReplies?: { enabled: boolean } }>("/api/config");
  const agents = config?.agents ?? [];
  const displayName = config?.displayName ?? "You";
  const quickRepliesEnabled = config?.quickReplies?.enabled ?? false;

  useEffect(() => {
    if (!config) return;
    const plugins = (config as Record<string, unknown>).plugins as Record<string, boolean> | undefined;
    const enabled = PLUGINS
      .filter((p) => plugins?.[p.id] ?? p.enabledByDefault)
      .map((p) => p.id);
    setEnabledPlugins(enabled);
  }, [config]);

  // Threads
  const threadsUrl = wsUrl("/api/threads");
  const [threads, , refetchThreads] = useFetch<ThreadListItem[]>(threadsUrl);
  const threadList = threads ?? [];

  // Status polling
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

  // Document title
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId);
  const activeWorkspaceName = activeWorkspace?.name;
  useEffect(() => {
    document.title = activeWorkspaceName ? `${activeWorkspaceName} | Entourage` : "Entourage";
  }, [activeWorkspaceName]);

  // Git badge
  const fetchGitBadge = useCallback(async () => {
    if (!enabledPlugins.includes("git")) {
      setGitChangeCount(0);
      return;
    }
    try {
      const res = await fetch(wsUrl("/api/git/status"));
      if (!res.ok) return;
      const data = await res.json();
      setGitIsRepo(data.isRepo);
      setGitChangeCount(data.staged.length + data.unstaged.length);
    } catch {
      setGitIsRepo(false);
    }
  }, [enabledPlugins, wsUrl]);

  useEffect(() => {
    fetchGitBadge();
    const interval = setInterval(fetchGitBadge, 5000);
    return () => clearInterval(interval);
  }, [fetchGitBadge]);

  // Navigation helpers
  const navigateToThread = useCallback(
    (threadId: string) => router.push(`/w/${workspaceId}/${threadId}`),
    [router, workspaceId]
  );

  const navigateToWorkspace = useCallback(
    () => router.push(`/w/${workspaceId}`),
    [router, workspaceId]
  );

  // Workspace handlers
  const handleSelectWorkspace = useCallback(
    (id: string) => {
      if (id === workspaceId) return;
      router.push(`/w/${id}`);
    },
    [workspaceId, router]
  );

  const handleRemoveWorkspace = useCallback(
    async (id: string) => {
      await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
      setWorkspaces((prev) => {
        const next = prev.filter((w) => w.id !== id);
        if (workspaceId === id) {
          if (next.length > 0) {
            router.replace(`/w/${next[0].id}`);
          } else {
            router.replace("/");
          }
        }
        return next;
      });
    },
    [workspaceId, router]
  );

  const handleEditWorkspace = useCallback(
    async (id: string, updates: { name?: string; color?: string; icon?: Icon | null }) => {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setWorkspaces((prev) => prev.map((w) => (w.id === id ? updated : w)));
    },
    []
  );

  const handleReorderWorkspaces = useCallback(
    async (orderedIds: string[]) => {
      setWorkspaces((prev) => {
        const map = new Map(prev.map((w) => [w.id, w]));
        return orderedIds.map((id) => map.get(id)).filter(Boolean) as Workspace[];
      });
      await fetch("/api/workspaces/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
    },
    []
  );

  const handlePluginClick = useCallback((pluginId: string) => {
    if (pluginId === "git") setShowGitDialog(true);
    if (pluginId === "files") setShowFileBrowser(true);
    if (pluginId === "terminal") setShowTerminal(true);
  }, []);

  const handleArchiveThread = useCallback(
    async (threadId: string, archived: boolean) => {
      const res = await fetch(wsUrl(`/api/threads/${threadId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) return;
      refetchThreads();
      if (archived && selectedThreadId === threadId) {
        router.push(`/w/${workspaceId}`);
      }
    },
    [refetchThreads, selectedThreadId, wsUrl, router, workspaceId]
  );

  const handleThreadCreated = useCallback(
    (thread: ThreadWithMessages) => {
      refetchThreads();
      router.push(`/w/${workspaceId}/${thread.id}`);
    },
    [refetchThreads, router, workspaceId]
  );

  const handleWorkspaceAdded = useCallback(
    (ws: Workspace) => {
      setWorkspaces((prev) => [...prev, ws]);
      setShowAddWorkspace(false);
      router.push(`/w/${ws.id}`);
    },
    [router]
  );

  // Context value
  const contextValue: WorkspaceLayoutContextValue = {
    workspaces,
    activeWorkspaceId: workspaceId,
    activeWorkspace,
    threads: threadList,
    refetchThreads,
    agents,
    displayName,
    quickRepliesEnabled,
    refetchConfig,
    statuses,
    unreadByThread,
    wsUrl,
    navigateToThread,
    navigateToWorkspace,
    openNewThread: () => setShowNewThread(true),
    handleRemoveWorkspace,
    handleEditWorkspace,
    handleReorderWorkspaces,
    handleSelectWorkspace,
    openAddWorkspace: () => setShowAddWorkspace(true),
    openSettings: () => setShowSettings(true),
    enabledPlugins,
    handlePluginClick,
    gitChangeCount,
    gitIsRepo,
    isMobile,
    openMobileMenu: () => setShowMobileMenu(true),
  };

  // Loading skeleton
  if (!workspacesLoaded) {
    return (
      <div className="flex h-dvh overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
        {/* Mobile skeleton */}
        <div className="flex flex-col w-full animate-pulse md:hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <div className="flex flex-col gap-2 p-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-700" style={{ width: `${60 + (i % 3) * 15}%` }} />
                  <div className="h-3 rounded bg-zinc-100 dark:bg-zinc-800" style={{ width: `${40 + (i % 4) * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Desktop skeleton */}
        <div className="hidden md:contents">
          <div className="flex flex-col items-center gap-2 py-3 px-2 border-r border-zinc-200 dark:border-zinc-800 w-16 shrink-0 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-700" />
            ))}
          </div>
          <div className="flex flex-col border-r border-zinc-200 dark:border-zinc-800 animate-pulse" style={{ width: SIDEBAR_DEFAULT }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="flex flex-col gap-2 p-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-700" style={{ width: `${60 + (i % 3) * 15}%` }} />
                    <div className="h-3 rounded bg-zinc-100 dark:bg-zinc-800" style={{ width: `${40 + (i % 4) * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-4 w-48 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const threadListEl = (
    <ThreadList
      threads={threadList}
      selectedThreadId={selectedThreadId}
      onSelectThread={(id) => router.push(`/w/${workspaceId}/${id}`)}
      onNewThread={() => setShowNewThread(true)}
      onOpenMenu={() => setShowMobileMenu(true)}
      onArchiveThread={handleArchiveThread}
      statuses={statuses}
      unreadByThread={unreadByThread}
      isMobile={isMobile}
      workspaceName={activeWorkspaceName}
    />
  );

  return (
    <WorkspaceProvider workspaceId={workspaceId}>
      <WorkspaceLayoutProvider value={contextValue}>
        <div className="flex h-dvh overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
          {isMobile ? (
            // On mobile: show thread list when no thread is selected, otherwise show children (thread page)
            selectedThreadId ? children : threadListEl
          ) : (
            <>
              <WorkspaceBar
                workspaces={workspaces}
                activeWorkspaceId={workspaceId}
                onSelectWorkspace={handleSelectWorkspace}
                onAddWorkspace={() => setShowAddWorkspace(true)}
                onRemoveWorkspace={handleRemoveWorkspace}
                onEditWorkspace={handleEditWorkspace}
                onReorderWorkspaces={handleReorderWorkspaces}
                onOpenSettings={() => setShowSettings(true)}
                enabledPlugins={enabledPlugins}
                onPluginClick={handlePluginClick}
                gitChangeCount={gitChangeCount}
                gitIsRepo={gitIsRepo}
              />
              <div className="relative flex-shrink-0" style={{ width: sidebarWidth }}>
                {threadListEl}
                <div
                  onMouseDown={startResize}
                  className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-violet-400/40 active:bg-violet-400/60 transition-colors"
                />
              </div>
              {children}
            </>
          )}
          <NewThreadDialog
            open={showNewThread}
            agents={agents}
            onClose={() => setShowNewThread(false)}
            onCreated={handleThreadCreated}
            workspaceId={workspaceId}
          />
          <SettingsDialog
            open={showSettings}
            onClose={() => {
              setShowSettings(false);
              refetchConfig();
            }}
          />
          <AddWorkspaceDialog
            open={showAddWorkspace}
            onClose={() => setShowAddWorkspace(false)}
            onAdded={handleWorkspaceAdded}
          />
          <GitDialog
            open={showGitDialog}
            onClose={() => {
              setShowGitDialog(false);
              fetchGitBadge();
            }}
            workspaceId={workspaceId}
          />
          <FileBrowserDialog
            open={showFileBrowser}
            onClose={() => setShowFileBrowser(false)}
            workspaceId={workspaceId}
          />
          <TerminalDialog
            open={showTerminal}
            onClose={() => setShowTerminal(false)}
            workspaceId={workspaceId}
          />
          {isMobile && (
            <MobileMenuDrawer
              open={showMobileMenu}
              onClose={() => setShowMobileMenu(false)}
              workspaces={workspaces}
              activeWorkspaceId={workspaceId}
              onSelectWorkspace={handleSelectWorkspace}
              onAddWorkspace={() => setShowAddWorkspace(true)}
              onOpenSettings={() => setShowSettings(true)}
              enabledPlugins={enabledPlugins}
              onPluginClick={handlePluginClick}
              gitChangeCount={gitChangeCount}
              gitIsRepo={gitIsRepo}
            />
          )}
        </div>
      </WorkspaceLayoutProvider>
    </WorkspaceProvider>
  );
}
```

- [ ] **Step 2: Verify the layout compiles**

Run: `npm run build`
Expected: Build succeeds. The layout is created but no routes point to it yet (the `/w/` path has no pages yet).

- [ ] **Step 3: Commit**

```bash
git add src/app/w/[workspaceId]/layout.tsx
git commit -m "feat: add workspace layout with URL-driven state"
```

---

### Task 4: Build the Workspace Page (No Thread Selected)

**Files:**
- Create: `src/app/w/[workspaceId]/page.tsx`

- [ ] **Step 1: Create the workspace page**

```typescript
"use client";

import { useWorkspaceLayout } from "@/contexts/WorkspaceLayoutContext";

export default function WorkspacePage() {
  const { isMobile } = useWorkspaceLayout();

  // On mobile, the thread list is shown by the layout when no threadId is in the URL.
  // On desktop, this page fills the main content area with an empty state.
  if (isMobile) return null;

  return (
    <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
      <p className="text-sm">Select a thread or start a new one</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev`
Navigate to `http://localhost:5555/w/any-id` in the browser. You should see the workspace layout with the empty state. (If `any-id` is not a valid workspace, it should redirect to `/`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/w/[workspaceId]/page.tsx
git commit -m "feat: add workspace page with empty thread state"
```

---

### Task 5: Build the Thread Page

**Files:**
- Create: `src/app/w/[workspaceId]/[threadId]/page.tsx`

- [ ] **Step 1: Create the thread page**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ThreadWithMessages, Message, MessageImage, PermissionLevel } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { useAgentStream } from "@/hooks/useSSE";
import { useWorkspaceLayout } from "@/contexts/WorkspaceLayoutContext";
import ThreadDetail from "@/components/ThreadDetail";

export default function ThreadPage() {
  const { threadId, workspaceId } = useParams<{ threadId: string; workspaceId: string }>();
  const router = useRouter();
  const {
    wsUrl,
    agents,
    displayName,
    quickRepliesEnabled,
    refetchThreads,
    threads,
    activeWorkspace,
    isMobile,
  } = useWorkspaceLayout();

  const streamCompleteThreadId = useRef<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Fetch thread data
  const threadUrl = wsUrl(`/api/threads/${threadId}`);
  const [selectedThread, setSelectedThread, refetchThread, threadError] =
    useFetch<ThreadWithMessages>(threadUrl);

  // Redirect on 404
  useEffect(() => {
    if (threadError && threadError.includes("404")) {
      router.replace(`/w/${workspaceId}`);
    }
  }, [threadError, router, workspaceId]);

  // Document title
  useEffect(() => {
    if (selectedThread?.title && activeWorkspace?.name) {
      document.title = `${selectedThread.title} — ${activeWorkspace.name} | Entourage`;
    }
  }, [selectedThread?.title, activeWorkspace?.name]);

  // Suggestions
  const handleInlineSuggestions = useCallback((inlineSuggestions: string[]) => {
    if (inlineSuggestions.length > 0) {
      setSuggestions(inlineSuggestions);
    }
  }, []);

  const handleStreamComplete = useCallback(
    (completedThreadId: string) => {
      streamCompleteThreadId.current = completedThreadId;
      refetchThreads();
      if (completedThreadId === threadId) {
        refetchThread();
      }
    },
    [threadId, refetchThread, refetchThreads]
  );

  const { streamingMessages, isStreaming, sendMessage, stopAgent, reattach } =
    useAgentStream(threadId, handleStreamComplete, workspaceId, handleInlineSuggestions);

  // Re-attach to streams on mount
  useEffect(() => {
    if (!selectedThread) return;
    const pendingStreams = selectedThread.messages.filter(
      (m) => m.status === "streaming" && m.agentId
    );
    for (const msg of pendingStreams) {
      reattach(selectedThread.id, msg.agentId!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id, reattach]);

  // When switching to a thread that just completed streaming, refetch
  useEffect(() => {
    if (
      streamCompleteThreadId.current &&
      streamCompleteThreadId.current === threadId
    ) {
      streamCompleteThreadId.current = null;
      refetchThread();
    }
  }, [threadId, refetchThread]);

  // Restore persisted suggestions once when thread first loads
  const lastRestoredThreadId = useRef<string | null>(null);

  useEffect(() => {
    setSuggestions([]);
    lastRestoredThreadId.current = null;
  }, [threadId]);

  useEffect(() => {
    if (!selectedThread || lastRestoredThreadId.current === selectedThread.id) return;
    lastRestoredThreadId.current = selectedThread.id;
    const lastAssistant = [...selectedThread.messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.status === "complete");
    const persisted = lastAssistant?.suggestions ?? [];
    if (persisted.length > 0) {
      setSuggestions(persisted);
    }
  }, [selectedThread]);

  // Clear unread on mount
  useEffect(() => {
    fetch(wsUrl(`/api/threads/${threadId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearUnread: true }),
    }).catch(() => {});
  }, [threadId, wsUrl]);

  // Permission level
  const effectivePermissionLevel: PermissionLevel =
    selectedThread?.permissionLevel ?? activeWorkspace?.permissionLevel ?? "full";

  const handleChangePermissionLevel = useCallback(
    async (level: PermissionLevel) => {
      const res = await fetch(wsUrl(`/api/threads/${threadId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionLevel: level }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setSelectedThread((prev) =>
        prev ? { ...prev, permissionLevel: updated.permissionLevel } : prev
      );
    },
    [threadId, setSelectedThread, wsUrl]
  );

  const handleDraftChange = useCallback((hasText: boolean) => {
    if (hasText) {
      setSuggestions((prev) => (prev.length === 0 ? prev : []));
    }
  }, []);

  // Send message
  const sendUserMessage = useCallback(
    async (content: string, images?: MessageImage[], attachedThreadIds?: string[]) => {
      const res = await fetch(wsUrl(`/api/threads/${threadId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          ...(images && images.length > 0 ? { images } : {}),
          ...(attachedThreadIds && attachedThreadIds.length > 0 ? { attachedThreadIds } : {}),
        }),
      });

      if (!res.ok) return false;

      const { message, targetAgents, threadUpdated, thread } = await res.json();

      setSelectedThread((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, message],
              agents: thread?.agents ?? prev.agents,
              updatedAt: thread?.updatedAt ?? prev.updatedAt,
            }
          : prev
      );

      if (threadUpdated) {
        refetchThreads();
      }

      sendMessage(content, targetAgents, images, attachedThreadIds);
      return true;
    },
    [threadId, sendMessage, setSelectedThread, refetchThreads, wsUrl]
  );

  const handleSendMessage = useCallback(
    async (content: string, images?: MessageImage[], attachedThreadIds?: string[]) => {
      setSuggestions([]);
      await sendUserMessage(content, images, attachedThreadIds);
    },
    [sendUserMessage]
  );

  // Rename
  const handleRenameThread = useCallback(
    async (title: string) => {
      const res = await fetch(wsUrl(`/api/threads/${threadId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setSelectedThread((prev) => (prev ? { ...prev, title: updated.title } : prev));
      refetchThreads();
    },
    [threadId, setSelectedThread, refetchThreads, wsUrl]
  );

  // Rewind
  const rewindThread = useCallback(
    async (messageId: string, keepMessage = true, revertCode = false) => {
      const res = await fetch(wsUrl(`/api/threads/${threadId}/rewind`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, keepMessage, revertCode }),
      });
      if (!res.ok) return null;
      const updated = await res.json();
      setSelectedThread(updated);
      refetchThreads();
      return updated as ThreadWithMessages;
    },
    [threadId, setSelectedThread, refetchThreads, wsUrl]
  );

  const handleRewind = useCallback(
    async (messageId: string, options?: { keepMessage?: boolean; revertCode?: boolean }) => {
      await rewindThread(messageId, options?.keepMessage ?? true, options?.revertCode ?? false);
    },
    [rewindThread]
  );

  // Resend
  const handleResendMessage = useCallback(
    async (message: Message) => {
      if (message.role !== "user") return;
      setSuggestions([]);
      const rewound = await rewindThread(message.id, false);
      if (!rewound) return;
      await sendUserMessage(message.content, message.images);
    },
    [rewindThread, sendUserMessage]
  );

  return (
    <ThreadDetail
      thread={selectedThread}
      streamingMessages={streamingMessages}
      onSendMessage={handleSendMessage}
      onStop={stopAgent}
      onRenameThread={handleRenameThread}
      onRewind={handleRewind}
      onResendMessage={handleResendMessage}
      isStreaming={isStreaming}
      allAgents={agents}
      displayName={displayName}
      isMobile={isMobile}
      onBack={isMobile ? () => router.back() : undefined}
      suggestions={quickRepliesEnabled && !isStreaming ? suggestions : []}
      onSuggestionSelect={(text: string) => {
        setSuggestions([]);
        handleSendMessage(text);
      }}
      onDraftChange={handleDraftChange}
      permissionLevel={effectivePermissionLevel}
      onChangePermissionLevel={handleChangePermissionLevel}
      workspaceThreads={threads.length > 0 ? threads : undefined}
    />
  );
}
```

- [ ] **Step 2: Verify the thread page renders**

Run: `npm run dev`
Navigate to `http://localhost:5555/w/{validWorkspaceId}/{validThreadId}`. You should see the thread detail with messages. Verify streaming works by sending a message.

- [ ] **Step 3: Commit**

```bash
git add src/app/w/[workspaceId]/[threadId]/page.tsx
git commit -m "feat: add thread page with streaming and URL routing"
```

---

### Task 6: Rewrite Root Page as Redirect

**Files:**
- Rewrite: `src/app/page.tsx`

- [ ] **Step 1: Rewrite `src/app/page.tsx`**

Replace the entire contents of `src/app/page.tsx` with a thin redirect component:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Workspace } from "@/lib/types";
import AddWorkspaceDialog from "@/components/AddWorkspaceDialog";

export default function RootPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [noWorkspaces, setNoWorkspaces] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((ws: Workspace[]) => {
        if (ws.length === 0) {
          setNoWorkspaces(true);
          setLoading(false);
          return;
        }
        const saved = localStorage.getItem("entourage-active-workspace");
        const match = ws.find((w) => w.id === saved);
        const targetId = match ? match.id : ws[0].id;
        router.replace(`/w/${targetId}`);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  if (noWorkspaces) {
    return (
      <div className="flex h-dvh overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
        <AddWorkspaceDialog
          open
          inline
          onClose={() => {}}
          onAdded={(ws: Workspace) => {
            router.replace(`/w/${ws.id}`);
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-dvh overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 items-center justify-center">
        <div className="h-4 w-48 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      </div>
    );
  }

  // Fetch failed — show error with retry
  return (
    <div className="flex h-dvh overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-sm text-zinc-500">Failed to load workspaces</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-violet-600 hover:underline"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the redirect works**

Run: `npm run dev`
Navigate to `http://localhost:5555/`. The browser should redirect to `/w/{workspaceId}` and show the workspace layout with thread list.

- [ ] **Step 3: Verify the full flow**

Test these scenarios manually:
1. `/` → redirects to `/w/{lastUsedWorkspaceId}`
2. Click a thread → URL changes to `/w/{wId}/{tId}`, thread detail shows
3. Click browser back → URL goes to `/w/{wId}`, thread deselected
4. Click a different workspace → URL changes to `/w/{newWId}`
5. Create a new thread → URL changes to `/w/{wId}/{newTId}`
6. Open the same URL in a new tab → same workspace and thread load
7. Send a message in tab 1, switch to tab 2 with same thread → stream re-attaches
8. On mobile: thread view shows back button, tapping it goes to `/w/{wId}`

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: rewrite root page as redirect to last workspace"
```

---

### Task 7: Clean Up and Verify Build

**Files:**
- Modify: `src/app/page.tsx` (if any leftover code)

- [ ] **Step 1: Remove any dead code**

Check that the old `Home` component in `src/app/page.tsx` is fully replaced. There should be no leftover imports or functions from the old monolithic component.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All existing tests pass (the tests in `src/lib/__tests__/` test backend utilities and should be unaffected).

- [ ] **Step 5: Commit any fixes**

Stage only the specific files that were modified (avoid `git add -A` which could stage unrelated files):

```bash
git add src/app/page.tsx src/app/w/ src/hooks/useFetch.ts src/contexts/WorkspaceLayoutContext.tsx
git commit -m "chore: clean up after URL routing migration"
```
