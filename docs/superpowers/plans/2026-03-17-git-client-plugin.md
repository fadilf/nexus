# Git Client Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a git client plugin to Entourage that lets users view status, stage/unstage files, view diffs, and commit — all from a dialog overlay.

**Architecture:** Backend uses `simple-git` npm package in Next.js API routes to interact with the workspace's git repo. Frontend adds a plugin system to WorkspaceBar (plugin icons section + enable/disable in Settings) and a GitDialog component with two-column layout (file list + diff viewer). The git plugin is the first plugin in a lightweight registry system.

**Tech Stack:** simple-git, Next.js API routes, React, TypeScript, Tailwind CSS, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-17-git-client-plugin-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/plugins.ts` | Plugin registry (defines available plugins), config read/write helpers for enabled state |
| `src/app/api/git/status/route.ts` | GET — returns branch, staged files, unstaged files, isRepo flag |
| `src/app/api/git/diff/route.ts` | GET — returns unified diff for a single file |
| `src/app/api/git/stage/route.ts` | POST — stage or unstage files, returns updated status |
| `src/app/api/git/commit/route.ts` | POST — commit staged changes |
| `src/components/GitDialog.tsx` | Main dialog overlay — orchestrates status fetching, selected file state, two-column layout |
| `src/components/GitFileList.tsx` | Left column — staged/unstaged file sections with checkboxes |
| `src/components/GitDiffViewer.tsx` | Right column — parses and renders unified diff with line numbers and coloring |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `Plugin`, `GitFileEntry`, `GitStatus` types |
| `src/lib/agent-store.ts` | Add `loadPlugins()` and `savePlugins()` helpers that read/write the `plugins` key in config |
| `src/app/api/config/route.ts` | Include `plugins` in GET response and support PATCH for plugins |
| `src/components/WorkspaceBar.tsx` | Add plugin icon section between Settings gear and workspace list |
| `src/components/SettingsDialog.tsx` | Add "Plugins" tab with toggle switches |
| `src/app/page.tsx` | Add `gitDialogOpen` state, `gitChangeCount` state, pass plugin props to WorkspaceBar, render GitDialog |

---

## Task 1: Install simple-git and add types

**Files:**
- Modify: `package.json`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Install simple-git**

Run:
```bash
npm install simple-git
```

- [ ] **Step 2: Add git and plugin types to types.ts**

Add to the end of `src/lib/types.ts`:

```ts
export type Plugin = {
  id: string;
  name: string;
  icon: string;
  enabledByDefault: boolean;
};

export type GitFileEntry = {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked";
};

export type GitStatus = {
  isRepo: boolean;
  branch: string;
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
};
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/types.ts
git commit -m "feat(git-plugin): install simple-git and add types"
```

---

## Task 2: Plugin registry and config persistence

**Files:**
- Create: `src/lib/plugins.ts`
- Modify: `src/lib/agent-store.ts`
- Modify: `src/app/api/config/route.ts`

- [ ] **Step 1: Create plugin registry**

Create `src/lib/plugins.ts`:

```ts
import { Plugin, GitFileEntry } from "./types";

export const PLUGINS: Plugin[] = [
  {
    id: "git",
    name: "Source Control",
    icon: "GitBranch",
    enabledByDefault: true,
  },
];

export function mapGitStatus(code: string): GitFileEntry["status"] {
  switch (code) {
    case "M": return "modified";
    case "A": return "added";
    case "D": return "deleted";
    case "R": return "renamed";
    default: return "modified";
  }
}
```

- [ ] **Step 2: Add plugin config helpers to agent-store.ts**

Add these exports to `src/lib/agent-store.ts`:

```ts
export async function loadPlugins(): Promise<Record<string, boolean>> {
  const config = await loadConfig();
  return (config as Record<string, unknown>).plugins as Record<string, boolean> ?? {};
}

export async function savePlugins(plugins: Record<string, boolean>): Promise<void> {
  const config = await loadConfig();
  await saveConfig({ ...config, plugins } as Config & { plugins: Record<string, boolean> });
}
```

Note: The `Config` type in agent-store.ts is `{ agents: Agent[]; displayName?: string }`. We need to widen it to include `plugins?: Record<string, boolean>`. Update the type definition at the top of agent-store.ts:

```ts
type Config = { agents: Agent[]; displayName?: string; plugins?: Record<string, boolean> };
```

Then the helpers simplify to:

```ts
export async function loadPlugins(): Promise<Record<string, boolean>> {
  const config = await loadConfig();
  return config.plugins ?? {};
}

export async function savePlugins(plugins: Record<string, boolean>): Promise<void> {
  const config = await loadConfig();
  await saveConfig({ ...config, plugins });
}
```

- [ ] **Step 3: Update config API route to include plugins**

Modify `src/app/api/config/route.ts`:

- In `GET`: also load plugins via `loadPlugins()` and include in response: `{ agents, displayName, plugins }`
- In `PATCH`: if `body.plugins` is an object, call `savePlugins(body.plugins)` and include updated plugins in response

```ts
import { NextResponse } from "next/server";
import { loadAgents, loadDisplayName, saveDisplayName, loadPlugins, savePlugins } from "@/lib/agent-store";

export async function GET() {
  const [agents, displayName, plugins] = await Promise.all([
    loadAgents(),
    loadDisplayName(),
    loadPlugins(),
  ]);
  return NextResponse.json({ agents, displayName, plugins });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  if (typeof body.displayName === "string") {
    await saveDisplayName(body.displayName.trim());
  }

  if (body.plugins && typeof body.plugins === "object") {
    await savePlugins(body.plugins);
  }

  const [displayName, plugins] = await Promise.all([
    loadDisplayName(),
    loadPlugins(),
  ]);
  return NextResponse.json({ displayName, plugins });
}
```

- [ ] **Step 4: Verify the build**

Run:
```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plugins.ts src/lib/agent-store.ts src/app/api/config/route.ts
git commit -m "feat(git-plugin): add plugin registry and config persistence"
```

---

## Task 3: Git API routes

**Files:**
- Create: `src/app/api/git/status/route.ts`
- Create: `src/app/api/git/diff/route.ts`
- Create: `src/app/api/git/stage/route.ts`
- Create: `src/app/api/git/commit/route.ts`

- [ ] **Step 1: Create git status route**

Create `src/app/api/git/status/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resolveWorkspaceDir } from "@/lib/workspace-context";
import simpleGit from "simple-git";
import { GitFileEntry, GitStatus } from "@/lib/types";
import { mapGitStatus } from "@/lib/plugins";

export async function GET(request: Request) {
  let dir: string;
  try {
    dir = await resolveWorkspaceDir(request);
  } catch {
    return NextResponse.json({ error: "Workspace not found" }, { status: 400 });
  }

  const git = simpleGit(dir);

  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return NextResponse.json({ isRepo: false, branch: "", staged: [], unstaged: [] } satisfies GitStatus);
    }

    const status = await git.status();

    const staged: GitFileEntry[] = [];
    const unstaged: GitFileEntry[] = [];

    for (const file of status.files) {
      // index field: staging area status
      if (file.index && file.index !== " " && file.index !== "?") {
        staged.push({
          path: file.path,
          status: mapGitStatus(file.index),
        });
      }
      // working_dir field: working directory status
      if (file.working_dir && file.working_dir !== " ") {
        unstaged.push({
          path: file.path,
          status: file.working_dir === "?" ? "untracked" : mapGitStatus(file.working_dir),
        });
      }
    }

    return NextResponse.json({
      isRepo: true,
      branch: status.current ?? "",
      staged,
      unstaged,
    } satisfies GitStatus);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Git error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create git diff route**

Create `src/app/api/git/diff/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resolveWorkspaceDir } from "@/lib/workspace-context";
import simpleGit from "simple-git";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(request: Request) {
  let dir: string;
  try {
    dir = await resolveWorkspaceDir(request);
  } catch {
    return NextResponse.json({ error: "Workspace not found" }, { status: 400 });
  }

  const url = new URL(request.url);
  const file = url.searchParams.get("file");
  const staged = url.searchParams.get("staged") === "true";

  if (!file) {
    return NextResponse.json({ error: "file parameter required" }, { status: 400 });
  }

  const git = simpleGit(dir);

  try {
    let diff: string;

    if (staged) {
      diff = await git.diff(["--cached", "--find-renames", "--", file]);
    } else {
      // Try normal diff first
      diff = await git.diff(["--find-renames", "--", file]);

      // If empty, file might be untracked — read raw content and format as all-additions
      if (!diff) {
        try {
          const content = await readFile(path.join(dir, file), "utf-8");
          const lines = content.split("\n");
          diff = `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` +
            lines.map((l) => `+${l}`).join("\n");
        } catch {
          diff = "";
        }
      }
    }

    return NextResponse.json({ diff });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Git error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create git stage route**

Create `src/app/api/git/stage/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resolveWorkspaceDir } from "@/lib/workspace-context";
import simpleGit from "simple-git";
import { GitFileEntry, GitStatus } from "@/lib/types";
import { mapGitStatus } from "@/lib/plugins";

export async function POST(request: Request) {
  let dir: string;
  try {
    dir = await resolveWorkspaceDir(request);
  } catch {
    return NextResponse.json({ error: "Workspace not found" }, { status: 400 });
  }

  const { files, action } = await request.json();

  if (!Array.isArray(files) || !["stage", "unstage"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const git = simpleGit(dir);

  try {
    if (action === "stage") {
      await git.add(files);
    } else {
      await git.raw(["reset", "HEAD", "--", ...files]);
    }

    // Return updated status
    const status = await git.status();
    const staged: GitFileEntry[] = [];
    const unstaged: GitFileEntry[] = [];

    for (const file of status.files) {
      if (file.index && file.index !== " " && file.index !== "?") {
        staged.push({ path: file.path, status: mapGitStatus(file.index) });
      }
      if (file.working_dir && file.working_dir !== " ") {
        unstaged.push({ path: file.path, status: file.working_dir === "?" ? "untracked" : mapGitStatus(file.working_dir) });
      }
    }

    return NextResponse.json({
      isRepo: true,
      branch: status.current ?? "",
      staged,
      unstaged,
    } satisfies GitStatus);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Git error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create git commit route**

Create `src/app/api/git/commit/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resolveWorkspaceDir } from "@/lib/workspace-context";
import simpleGit from "simple-git";

export async function POST(request: Request) {
  let dir: string;
  try {
    dir = await resolveWorkspaceDir(request);
  } catch {
    return NextResponse.json({ error: "Workspace not found" }, { status: 400 });
  }

  const { message } = await request.json();

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Commit message required" }, { status: 400 });
  }

  const git = simpleGit(dir);

  try {
    const result = await git.commit(message.trim());
    return NextResponse.json({
      hash: result.commit || "",
      message: message.trim(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Git error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 5: Verify the build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/git/
git commit -m "feat(git-plugin): add git status, diff, stage, and commit API routes"
```

---

## Task 4: GitDiffViewer component

**Files:**
- Create: `src/components/GitDiffViewer.tsx`

- [ ] **Step 1: Create GitDiffViewer**

Create `src/components/GitDiffViewer.tsx`. This component receives a raw unified diff string and renders it with line numbers and red/green highlighting.

```tsx
"use client";

type DiffLine = {
  type: "add" | "remove" | "context" | "hunk";
  content: string;
  oldLine?: number;
  newLine?: number;
};

function parseDiff(raw: string): DiffLine[] {
  if (!raw) return [];
  const lines = raw.split("\n");
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // Skip diff header lines (---, +++, diff, index)
    if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ")) {
      continue;
    }

    if (line.startsWith("@@")) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({ type: "hunk", content: line });
      continue;
    }

    if (line.startsWith("+")) {
      result.push({ type: "add", content: line.slice(1), newLine });
      newLine++;
    } else if (line.startsWith("-")) {
      result.push({ type: "remove", content: line.slice(1), oldLine });
      oldLine++;
    } else if (line.startsWith(" ") || line === "") {
      result.push({ type: "context", content: line.startsWith(" ") ? line.slice(1) : line, oldLine, newLine });
      oldLine++;
      newLine++;
    }
  }

  return result;
}

export default function GitDiffViewer({
  diff,
  fileName,
  fileStatus,
}: {
  diff: string | null;
  fileName: string | null;
  fileStatus: string | null;
}) {
  if (!fileName) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-500">
        Select a file to view changes
      </div>
    );
  }

  if (diff !== null && diff.includes("Binary file")) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-500">
        Binary file — diff not available
      </div>
    );
  }

  const lines = parseDiff(diff ?? "");

  return (
    <div className="flex h-full flex-col">
      {/* File header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 px-4 py-2.5">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{fileName}</span>
        {fileStatus && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{fileStatus}</span>
        )}
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5">
        {lines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-500">
            No changes
          </div>
        ) : (
          lines.map((line, i) => {
            if (line.type === "hunk") {
              return (
                <div
                  key={i}
                  className="border-y border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-1 text-zinc-500 dark:text-zinc-400 italic"
                >
                  {line.content}
                </div>
              );
            }

            const bgColor =
              line.type === "add"
                ? "bg-green-50 dark:bg-green-900/20"
                : line.type === "remove"
                ? "bg-red-50 dark:bg-red-900/20"
                : "";

            const textColor =
              line.type === "add"
                ? "text-green-700 dark:text-green-400"
                : line.type === "remove"
                ? "text-red-700 dark:text-red-400"
                : "text-zinc-700 dark:text-zinc-300";

            const lineNum =
              line.type === "add"
                ? line.newLine
                : line.type === "remove"
                ? line.oldLine
                : line.oldLine;

            return (
              <div key={i} className={`flex ${bgColor}`}>
                <span className="w-12 flex-shrink-0 select-none pr-2 text-right text-zinc-400 dark:text-zinc-600">
                  {lineNum}
                </span>
                <span className="w-4 flex-shrink-0 select-none text-center text-zinc-400 dark:text-zinc-600">
                  {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                </span>
                <span className={`flex-1 whitespace-pre-wrap break-all pr-4 ${textColor}`}>
                  {line.content}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run:
```bash
npm run build
```
Expected: Build succeeds (component not yet mounted, but should compile).

- [ ] **Step 3: Commit**

```bash
git add src/components/GitDiffViewer.tsx
git commit -m "feat(git-plugin): add GitDiffViewer component"
```

---

## Task 5: GitFileList component

**Files:**
- Create: `src/components/GitFileList.tsx`

- [ ] **Step 1: Create GitFileList**

Create `src/components/GitFileList.tsx`. This component renders staged and unstaged file lists with checkboxes and selection state.

```tsx
"use client";

import { GitFileEntry } from "@/lib/types";

function statusBadge(status: GitFileEntry["status"], staged: boolean) {
  const label = status === "untracked" ? "?" : status[0].toUpperCase();
  const color = staged
    ? status === "deleted" ? "text-red-500" : "text-green-500"
    : status === "deleted" ? "text-red-500" : status === "untracked" ? "text-zinc-400" : "text-yellow-500";
  return (
    <span className={`w-4 text-center text-xs font-semibold ${color}`}>{label}</span>
  );
}

export default function GitFileList({
  staged,
  unstaged,
  selectedFile,
  onSelectFile,
  onStage,
  onUnstage,
  commitMessage,
  onCommitMessageChange,
  onCommit,
  committing,
}: {
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  selectedFile: string | null;
  onSelectFile: (path: string, isStaged: boolean) => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  commitMessage: string;
  onCommitMessageChange: (msg: string) => void;
  onCommit: () => void;
  committing: boolean;
}) {
  const canCommit = staged.length > 0 && commitMessage.trim().length > 0 && !committing;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Staged */}
        {staged.length > 0 && (
          <div className="px-3 pt-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Staged Changes ({staged.length})
            </div>
            {staged.map((file) => (
              <div
                key={`staged-${file.path}`}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 ${
                  selectedFile === file.path
                    ? "bg-violet-50 dark:bg-violet-900/20"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                }`}
                onClick={() => onSelectFile(file.path, true)}
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => onUnstage(file.path)}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-violet-600"
                />
                {statusBadge(file.status, true)}
                <span className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
                  {file.path}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Unstaged */}
        {unstaged.length > 0 && (
          <div className="px-3 pt-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Changes ({unstaged.length})
            </div>
            {unstaged.map((file) => (
              <div
                key={`unstaged-${file.path}`}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 ${
                  selectedFile === file.path
                    ? "bg-violet-50 dark:bg-violet-900/20"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                }`}
                onClick={() => onSelectFile(file.path, false)}
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => onStage(file.path)}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-violet-600"
                />
                {statusBadge(file.status, false)}
                <span className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
                  {file.path}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {staged.length === 0 && unstaged.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500 py-12">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-sm">Working tree clean</span>
          </div>
        )}
      </div>

      {/* Commit area */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 p-3">
        <textarea
          value={commitMessage}
          onChange={(e) => onCommitMessageChange(e.target.value)}
          placeholder="Commit message..."
          rows={3}
          className="w-full resize-none rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          onClick={onCommit}
          disabled={!canCommit}
          className="mt-2 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {committing ? "Committing..." : `Commit${staged.length > 0 ? ` (${staged.length} file${staged.length > 1 ? "s" : ""})` : ""}`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/GitFileList.tsx
git commit -m "feat(git-plugin): add GitFileList component"
```

---

## Task 6: GitDialog component

**Files:**
- Create: `src/components/GitDialog.tsx`

- [ ] **Step 1: Create GitDialog**

Create `src/components/GitDialog.tsx`. This is the main dialog that orchestrates status fetching, file selection, staging actions, and commit.

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { GitBranch } from "lucide-react";
import { GitStatus } from "@/lib/types";
import GitFileList from "./GitFileList";
import GitDiffViewer from "./GitDiffViewer";

export default function GitDialog({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string | null;
}) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedStaged, setSelectedStaged] = useState(false);
  const [diff, setDiff] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsParam = workspaceId ? `?workspaceId=${workspaceId}` : "";

  const fetchStatus = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/git/status${wsParam}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      const data: GitStatus = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, [workspaceId, wsParam]);

  // Fetch status on open
  useEffect(() => {
    if (open) {
      fetchStatus();
      setSelectedFile(null);
      setDiff(null);
      setCommitMessage("");
    }
  }, [open, fetchStatus]);

  // Fetch diff when file selected
  const fetchDiff = useCallback(
    async (filePath: string, staged: boolean) => {
      if (!workspaceId) return;
      try {
        const res = await fetch(
          `/api/git/diff${wsParam}&file=${encodeURIComponent(filePath)}&staged=${staged}`
        );
        if (!res.ok) throw new Error("Failed to fetch diff");
        const data = await res.json();
        setDiff(data.diff);
      } catch {
        setDiff(null);
      }
    },
    [workspaceId, wsParam]
  );

  const handleSelectFile = (path: string, isStaged: boolean) => {
    setSelectedFile(path);
    setSelectedStaged(isStaged);
    fetchDiff(path, isStaged);
  };

  const handleStage = async (path: string) => {
    await fetch(`/api/git/stage${wsParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [path], action: "stage" }),
    });
    await fetchStatus();
    // If the file we're viewing was just staged, re-fetch diff
    if (selectedFile === path) {
      setSelectedStaged(true);
      fetchDiff(path, true);
    }
  };

  const handleUnstage = async (path: string) => {
    await fetch(`/api/git/stage${wsParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: [path], action: "unstage" }),
    });
    await fetchStatus();
    if (selectedFile === path) {
      setSelectedStaged(false);
      fetchDiff(path, false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setCommitting(true);
    try {
      const res = await fetch(`/api/git/commit${wsParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMessage.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Commit failed");
        return;
      }
      setCommitMessage("");
      setSelectedFile(null);
      setDiff(null);
      await fetchStatus();
    } finally {
      setCommitting(false);
    }
  };

  if (!open) return null;

  const totalChanges = (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0);
  const selectedFileStatus = selectedFile
    ? [...(status?.staged ?? []), ...(status?.unstaged ?? [])].find((f) => f.path === selectedFile)?.status ?? null
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-4xl flex-col rounded-xl bg-white dark:bg-zinc-800 shadow-xl mx-4" style={{ height: "70vh", maxHeight: 600 }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <GitBranch className="h-4 w-4 text-violet-500" />
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Source Control</span>
            {status?.branch && (
              <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                {status.branch}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {totalChanges > 0 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {totalChanges} change{totalChanges !== 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 text-xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Body */}
        {status && !status.isRepo ? (
          <div className="flex flex-1 items-center justify-center text-zinc-400 dark:text-zinc-500">
            Not a git repository
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            {/* Left: file list */}
            <div className="w-72 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-700">
              <GitFileList
                staged={status?.staged ?? []}
                unstaged={status?.unstaged ?? []}
                selectedFile={selectedFile}
                onSelectFile={handleSelectFile}
                onStage={handleStage}
                onUnstage={handleUnstage}
                commitMessage={commitMessage}
                onCommitMessageChange={setCommitMessage}
                onCommit={handleCommit}
                committing={committing}
              />
            </div>

            {/* Right: diff viewer */}
            <div className="flex-1 min-w-0">
              <GitDiffViewer
                diff={diff}
                fileName={selectedFile}
                fileStatus={selectedFileStatus}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/GitDialog.tsx
git commit -m "feat(git-plugin): add GitDialog component"
```

---

## Task 7: Add plugin section to WorkspaceBar

**Files:**
- Modify: `src/components/WorkspaceBar.tsx`

- [ ] **Step 1: Update WorkspaceBar props and imports**

Add to the imports in `WorkspaceBar.tsx`:

```ts
import { GitBranch } from "lucide-react";
```

Update the `Props` type to add:

```ts
enabledPlugins?: string[];
onPluginClick?: (pluginId: string) => void;
gitChangeCount?: number;
gitIsRepo?: boolean;
```

Add these to the destructured props with defaults:

```ts
enabledPlugins = [],
onPluginClick,
gitChangeCount = 0,
gitIsRepo = true,
```

- [ ] **Step 2: Add plugin icon section between Settings gear and workspace list**

After the Settings gear button and its separator, before the workspace list, add a plugin section. Insert this JSX after the first separator (`<div className="w-8 h-px bg-zinc-700 my-1" />`):

```tsx
{/* Plugin icons */}
{enabledPlugins.includes("git") && (
  <>
    <button
      onClick={() => onPluginClick?.("git")}
      disabled={!gitIsRepo}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors ml-3 ${
        gitIsRepo
          ? "text-zinc-400 hover:text-white hover:bg-zinc-700"
          : "text-zinc-600 cursor-not-allowed"
      }`}
      title={gitIsRepo ? "Source Control" : "Not a git repository"}
    >
      <GitBranch size={20} />
      {gitChangeCount > 0 && gitIsRepo && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-medium text-white">
          {gitChangeCount > 99 ? "99+" : gitChangeCount}
        </span>
      )}
    </button>
    <div className="w-8 h-px bg-zinc-700 my-1" />
  </>
)}
```

- [ ] **Step 3: Verify the build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/WorkspaceBar.tsx
git commit -m "feat(git-plugin): add plugin icon section to WorkspaceBar"
```

---

## Task 8: Add Plugins tab to SettingsDialog

**Files:**
- Modify: `src/components/SettingsDialog.tsx`

- [ ] **Step 1: Update tab type and add plugin state**

Change the `Tab` type to include "plugins":

```ts
type Tab = "general" | "agents" | "plugins";
```

Add state for plugins:

```ts
const [plugins, setPlugins] = useState<Record<string, boolean>>({});
```

Update `fetchConfig` to also load plugins:

```ts
const fetchConfig = useCallback(async () => {
  const res = await fetch(`/api/config`);
  if (res.ok) {
    const data = await res.json();
    setDisplayName(data.displayName || "");
    setSavedDisplayName(data.displayName || "");
    setPlugins(data.plugins || {});
  }
}, []);
```

- [ ] **Step 2: Add Plugins tab button**

In the tab bar, add a third tab. Update the tabs array:

```tsx
{([["general", "General"], ["agents", "Agent Profiles"], ["plugins", "Plugins"]] as const).map(([key, label]) => (
```

- [ ] **Step 3: Add Plugins tab content**

Import `PLUGINS` from `@/lib/plugins` at the top of the file. Then add the plugins content after the agents tab content (before the final closing `)}` of the content area):

```tsx
) : tab === "plugins" ? (
  <div className="space-y-1">
    <h4 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Plugins</h4>
    {PLUGINS.map((plugin) => {
      const enabled = plugins[plugin.id] ?? plugin.enabledByDefault;
      return (
        <div
          key={plugin.id}
          className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-700"
        >
          <div>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{plugin.name}</span>
          </div>
          <button
            onClick={async () => {
              const updated = { ...plugins, [plugin.id]: !enabled };
              setPlugins(updated);
              await fetch("/api/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plugins: updated }),
              });
            }}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              enabled ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
      );
    })}
  </div>
```

Note: the existing code structure has `tab === "general" ? (...) : (...)` for the agents tab. You need to change this to `tab === "general" ? (...) : tab === "agents" ? (...) : tab === "plugins" ? (...) : null`.

- [ ] **Step 4: Verify the build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsDialog.tsx
git commit -m "feat(git-plugin): add Plugins tab to SettingsDialog"
```

---

## Task 9: Wire everything together in page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add imports and state**

Add import for GitDialog:

```ts
import GitDialog from "@/components/GitDialog";
```

Add import for PLUGINS:

```ts
import { PLUGINS } from "@/lib/plugins";
```

Add state variables in the `Home` component:

```ts
const [showGitDialog, setShowGitDialog] = useState(false);
const [enabledPlugins, setEnabledPlugins] = useState<string[]>([]);
const [gitChangeCount, setGitChangeCount] = useState(0);
const [gitIsRepo, setGitIsRepo] = useState(true);
```

- [ ] **Step 2: Load enabled plugins from config**

After the existing `config` fetch, derive enabled plugins from the config data. Add a `useEffect` that reacts to `config`:

```ts
useEffect(() => {
  if (!config) return;
  const plugins = (config as Record<string, unknown>).plugins as Record<string, boolean> | undefined;
  const enabled = PLUGINS
    .filter((p) => plugins?.[p.id] ?? p.enabledByDefault)
    .map((p) => p.id);
  setEnabledPlugins(enabled);
}, [config]);
```

- [ ] **Step 3: Fetch git change count for badge**

Add a `useEffect` that fetches git status when the workspace changes or when the git dialog closes, to update the badge count:

```ts
const fetchGitBadge = useCallback(async () => {
  if (!activeWorkspaceId || !enabledPlugins.includes("git")) {
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
}, [activeWorkspaceId, enabledPlugins, wsUrl]);

useEffect(() => {
  fetchGitBadge();
}, [fetchGitBadge]);
```

- [ ] **Step 4: Add plugin click handler and pass props to WorkspaceBar**

Add handler:

```ts
const handlePluginClick = useCallback((pluginId: string) => {
  if (pluginId === "git") setShowGitDialog(true);
}, []);
```

Add new props to the WorkspaceBar component in the JSX:

```tsx
<WorkspaceBar
  workspaces={workspaces}
  activeWorkspaceId={activeWorkspaceId}
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
```

- [ ] **Step 5: Render GitDialog and refresh badge on close**

Add after the AddWorkspaceDialog in the JSX:

```tsx
<GitDialog
  open={showGitDialog}
  onClose={() => {
    setShowGitDialog(false);
    fetchGitBadge();
  }}
  workspaceId={activeWorkspaceId}
/>
```

- [ ] **Step 6: Verify the build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 7: Manual smoke test**

Run:
```bash
npm run dev
```

Test the following:
1. Git icon appears in WorkspaceBar between Settings and workspaces
2. Clicking git icon opens the GitDialog
3. Files appear in staged/unstaged lists
4. Clicking a file shows its diff
5. Checkboxes stage/unstage files
6. Committing with a message works and refreshes the file list
7. Settings > Plugins tab shows the git toggle
8. Disabling the git plugin hides the icon from WorkspaceBar

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(git-plugin): wire GitDialog and plugin system into main page"
```

---

## Task 10: Lint check and final commit

- [ ] **Step 1: Run lint**

Run:
```bash
npm run lint
```

Fix any lint errors that appear.

- [ ] **Step 2: Run build one final time**

Run:
```bash
npm run build
```
Expected: Clean build with no errors.

- [ ] **Step 3: Final commit (if any lint fixes were needed)**

```bash
git add -A
git commit -m "fix(git-plugin): lint fixes"
```
