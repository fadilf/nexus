# Git Client Plugin — Design Spec

## Overview

Add a basic git client to Entourage as the first **plugin**. Users can view changed files, stage/unstage them, view diffs, and commit — all from a dialog overlay without leaving the app. Introduces a lightweight plugin system in the WorkspaceBar and SettingsDialog.

## Scope

**In scope (v1):**
- Git status: current branch, staged and unstaged file lists
- Stage/unstage individual files via checkboxes
- Unified diff viewer for selected files
- Commit with a message
- Plugin infrastructure: icon in WorkspaceBar, enable/disable in Settings

**Out of scope:**
- Branching (create, switch, merge)
- History / log browsing
- Push / pull / remote operations
- Conflict resolution
- Partial staging (hunks)

## Plugin System

### WorkspaceBar Layout

New layout order (top to bottom):

1. Settings gear
2. Separator
3. **Plugin icons** (git is the first; only shown if enabled)
4. Separator
5. Workspace list (draggable)
6. Separator
7. Add workspace button

### Plugin Registry

Plugins are defined in code, not user-created. Each plugin has:

```ts
type Plugin = {
  id: string;          // e.g. "git"
  name: string;        // e.g. "Source Control"
  icon: string;        // lucide icon name, e.g. "GitBranch"
  enabledByDefault: boolean;
};
```

Enabled/disabled state persists in the existing config store under a `plugins` key:

```json
{ "plugins": { "git": true } }
```

### SettingsDialog

New **"Plugins"** tab alongside "General" and "Agent Profiles". Shows each registered plugin with a toggle switch.

### WorkspaceBar Changes

- Receives `enabledPlugins: string[]` and `onPluginClick: (pluginId: string) => void` as new props
- Renders enabled plugin icons between Settings and the workspace list
- Git icon shows a small badge with the count of changed files (fetched periodically or on workspace change)
- If the active workspace is not a git repo, the git icon is dimmed with a tooltip

## Git Dialog

### Trigger

Clicking the git plugin icon in the WorkspaceBar opens `GitDialog` as a modal overlay (same pattern as `SettingsDialog`: `fixed inset-0 z-50 bg-black/40`).

### Layout

Two-column dialog, approximately 900×600px, responsive:

**Header:**
- Git branch icon + "Source Control" title
- Current branch name in a violet pill badge
- Total change count
- Close button (×)

**Left column (~280px):**
- **Staged Changes** section — files with checked checkboxes, change type badge (`M` green, `A` green, `D` red, `R` green)
- **Changes** section — unstaged/untracked files with unchecked checkboxes, `M` badge in yellow, `?` for untracked
- Clicking a checkbox stages or unstages the file
- Clicking a file row selects it and shows its diff on the right
- **Commit area** pinned at bottom — textarea for commit message, "Commit (N files)" button. Button disabled when no staged files or empty message.

**Right column (flex):**
- File name header with change type label
- Unified diff view: monospace font, line numbers, red background for deletions, green background for additions, hunk headers (`@@`) styled as separators
- Empty state when no file is selected: "Select a file to view changes"

### Empty States

- **No changes:** "Working tree clean" with a checkmark icon
- **Not a git repo:** git icon dimmed in WorkspaceBar; dialog not openable (or shows "Not a git repository")
- **Binary file selected:** "Binary file — diff not available"

## API Routes

All routes accept `?workspaceId=` query parameter to resolve the workspace directory via `resolveWorkspaceDir()`.

### `GET /api/git/status`

Returns the current git status for the workspace.

**Response:**
```ts
{
  isRepo: boolean;
  branch: string;
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
}

type GitFileEntry = {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked";
};
```

**Implementation:** `simpleGit(workspaceDir).status()` — map the result's `files` array into staged/unstaged buckets based on the index/working_dir fields.

### `GET /api/git/diff`

Returns the unified diff for a single file.

**Query params:** `file` (file path), `staged` ("true" or "false")

**Response:**
```ts
{ diff: string }  // raw unified diff text
```

**Implementation:**
- Staged: `git.diff(['--cached', '--', file])`
- Unstaged: `git.diff(['--', file])`

### `POST /api/git/stage`

Stage or unstage files.

**Body:**
```ts
{ files: string[]; action: "stage" | "unstage" }
```

**Response:** Updated status (same shape as `GET /api/git/status`).

**Implementation:**
- Stage: `git.add(files)`
- Unstage: `git.raw(['reset', 'HEAD', '--', ...files])`

### `POST /api/git/commit`

Commit staged changes.

**Body:**
```ts
{ message: string }
```

**Response:**
```ts
{ hash: string; message: string }
```

**Implementation:** `git.commit(message)`

## Frontend Components

### New Files

| File | Purpose |
|------|---------|
| `src/components/GitDialog.tsx` | Main dialog — fetches status on open and after mutations, manages selected file state, two-column layout |
| `src/components/GitFileList.tsx` | Left column — renders staged/unstaged sections, checkboxes, file selection highlight |
| `src/components/GitDiffViewer.tsx` | Right column — parses unified diff string into lines, renders with line numbers and red/green highlighting |
| `src/lib/plugins.ts` | Plugin registry and config helpers (read/write enabled state) |

### Modified Files

| File | Change |
|------|--------|
| `src/components/WorkspaceBar.tsx` | Add plugin icon section between settings and workspaces |
| `src/components/SettingsDialog.tsx` | Add "Plugins" tab with toggle switches |
| `src/app/page.tsx` | Manage `gitDialogOpen` state, pass plugin props to WorkspaceBar |
| `src/lib/types.ts` | Add `Plugin`, `GitFileEntry`, `GitStatus` types |
| `src/app/api/config/route.ts` | Support `plugins` key in config read/write |

### Data Flow

```
GitDialog opens
  → GET /api/git/status?workspaceId=X
  → Render file lists

User clicks file
  → GET /api/git/diff?workspaceId=X&file=Y&staged=Z
  → Render diff in right panel

User clicks checkbox
  → POST /api/git/stage { files: [path], action }
  → Re-fetch status
  → Re-fetch diff if selected file affected

User commits
  → POST /api/git/commit { message }
  → Clear message input
  → Re-fetch status
  → Clear diff panel
```

## Backend Dependency

**Package:** `simple-git` (npm)
- Thin wrapper around the native `git` CLI
- Returns structured JS objects for status, log, diff
- ~30M downloads/week, well-maintained

No other new dependencies required.

## Edge Cases

- **Not a git repo:** `isRepo: false` from status endpoint. Git icon dimmed in WorkspaceBar.
- **No changes:** Empty state in dialog with "Working tree clean" message.
- **Binary files:** Diff returns empty or binary notice. Show "Binary file — diff not available."
- **Empty commit message:** Commit button disabled.
- **No staged files:** Commit button disabled.
- **Large diffs:** Rendered as-is with overflow scroll. No truncation in v1.
- **Concurrent agent edits:** Status refreshes on dialog open and after every action, picking up external changes.
- **Git CLI not installed:** `simple-git` will throw. Catch and surface as "git not found" error state.
- **Untracked files:** `git diff` produces no output for untracked files. Read the raw file content and present as an all-additions diff.
- **Renamed files:** Use `--find-renames` flag when diffing to properly detect renames.
- **Badge refresh:** The WorkspaceBar badge refreshes on workspace switch and when the git dialog closes after a mutation. No background polling in v1.
