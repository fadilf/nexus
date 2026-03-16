# Move Settings to WorkspaceBar + Make Global

**Date:** 2026-03-16

## Summary

Move the settings entry point from the ThreadList footer to the WorkspaceBar (as a gear icon above the workspace list), and make settings (display name, agent profiles) global rather than workspace-scoped.

## Motivation

- Settings (agent profiles, display name) are more naturally global — users expect the same agents across all workspaces
- The WorkspaceBar is the right home for app-level controls like settings
- Removes the ThreadList footer, giving threads more vertical space

## UI Changes

### WorkspaceBar (desktop)

Add a gear icon (`Settings` from lucide-react) at the top of the WorkspaceBar, above the workspace list and separator. Clicking it opens the existing `SettingsDialog` modal.

```
┌──────────┐
│  ⚙️ gear  │  ← NEW
│──────────│
│  [WS 1]  │
│  [WS 2]  │
│──────────│
│  [  +  ] │
└──────────┘
```

Styling: consistent with the add-workspace button — `text-zinc-400 hover:text-white` icon, same sizing and spacing.

### ThreadList

Remove the settings footer entirely (the `border-t` section with the gear icon and "Settings" label at the bottom of ThreadList). Remove the `onOpenSettings` prop and `Settings` lucide-react import.

### Mobile

The WorkspaceBar is not rendered on mobile. To preserve settings access, add a gear icon button to the ThreadList **header** (next to the "New" button). This keeps settings one-tap accessible on mobile without adding the full WorkspaceBar.

## Data Model Changes

### Global config location

Global config is stored at `~/.nexus/config.json` (alongside the existing `~/.nexus/workspaces.json`). This cleanly separates global config from per-workspace thread data.

### agent-store.ts changes

- `loadAgents()`, `saveAgents()`, `loadDisplayName()`, `saveDisplayName()` — remove the `workspaceDir` parameter. Instead, resolve to `~/.nexus/config.json` via a new `resolveGlobalConfigDir()` helper (returns `~/.nexus/`).
- All callers updated to call without `workspaceDir`.

### API route changes

All routes that call `loadAgents(workspaceDir)` must be updated to call the new parameterless version:

- `/api/config/route.ts` — config read/write
- `/api/agents/route.ts` — agent CRUD
- `/api/agents/[agentId]/route.ts` — single agent CRUD
- `/api/threads/route.ts` — agent resolution on thread creation
- `/api/threads/[threadId]/messages/route.ts` — @mention resolution
- `/api/threads/[threadId]/stream/route.ts` — agent personality loading

### Client-side changes

- `SettingsDialog.tsx` — drop `workspaceId` from all fetch calls
- `page.tsx` — config fetch (`configUrl`) should always fetch `/api/config` without gating on `activeWorkspaceId` or using `wsUrl()`

### `/api/config` GET response

The GET response currently returns `workingDirectory: workspaceDir`. Since config is now global, this field is no longer meaningful in the config response. Remove `workingDirectory` from the config GET response. Components that need the workspace directory can get it from the workspace context instead.

### `resolveWorkspaceDir` removal from config/agent routes

The `/api/config` and `/api/agents` routes no longer need `resolveWorkspaceDir` since they use the global config path. Remove the import and usage. Thread routes (`/api/threads/...`) still need `resolveWorkspaceDir` for thread storage — only the `loadAgents()` call within them changes.

### Migration

Integrate migration into `resolveGlobalConfigDir()` itself: when `~/.nexus/config.json` does not exist, scan `~/.nexus/workspaces.json` for the first workspace entry that has a `.nexus/config.json` and copy it as the global config. This avoids race conditions with `loadConfig`'s default-config-creation fallback. Old per-workspace config files are left in place (they'll just be ignored).

### What stays workspace-scoped

- Threads remain workspace-scoped (each workspace has its own threads in `<workspaceDir>/.nexus/threads/`)
- Workspace metadata (name, color, directory) remains per-workspace in `~/.nexus/workspaces.json`

## Files to Change

1. **`src/components/WorkspaceBar.tsx`** — Add gear icon at top, accept `onOpenSettings` callback prop
2. **`src/components/ThreadList.tsx`** — Remove settings footer, remove `onOpenSettings` prop and `Settings` import. On mobile, add gear icon to header.
3. **`src/app/page.tsx`** — Pass `onOpenSettings` to WorkspaceBar. Remove `onOpenSettings` from ThreadList props. Change `configUrl` to fetch `/api/config` unconditionally.
4. **`src/components/SettingsDialog.tsx`** — Remove `workspaceId` prop and all `wsParam()` usage from fetch calls
5. **`src/app/api/config/route.ts`** — Use global config path instead of `resolveWorkspaceDir`
6. **`src/lib/agent-store.ts`** — Add `resolveGlobalConfigDir()`, remove `workspaceDir` param from all functions
7. **`src/app/api/agents/route.ts`** — Use parameterless `loadAgents()`
8. **`src/app/api/agents/[agentId]/route.ts`** — Use parameterless `loadAgents()`/`saveAgents()`
9. **`src/app/api/threads/route.ts`** — Use parameterless `loadAgents()`
10. **`src/app/api/threads/[threadId]/messages/route.ts`** — Use parameterless `loadAgents()`
11. **`src/app/api/threads/[threadId]/stream/route.ts`** — Use parameterless `loadAgents()`

## What stays the same

- SettingsDialog component internals (agent form, theme toggle, display name) — unchanged
- WorkspaceBar layout, sizing, workspace icons — unchanged
- ThreadList thread rendering — unchanged
- All thread/message handling — unchanged
