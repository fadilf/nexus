# Global Settings & WorkspaceBar Gear Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move settings entry point from ThreadList footer to WorkspaceBar gear icon, and make settings (agents, display name) global instead of workspace-scoped.

**Architecture:** The agent-store switches from workspace-relative config paths (`<workspaceDir>/.entourage/config.json`) to a single global path (`~/.entourage/config.json`). All API routes that read/write agents or display name drop their `workspaceDir` parameter. The UI moves the settings trigger from ThreadList footer to WorkspaceBar top, with a mobile fallback in ThreadList header.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-16-global-settings-and-workspace-bar-gear.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/agent-store.ts` | Modify | Switch from workspace-scoped to global config at `~/.entourage/config.json`. Add `resolveGlobalConfigDir()`. Remove `workspaceDir` param from all exported functions. Add migration logic. |
| `src/app/api/config/route.ts` | Modify | Remove `resolveWorkspaceDir` import/usage. Call parameterless agent-store functions. Remove `workingDirectory` from GET response. |
| `src/app/api/agents/route.ts` | Modify | Remove `resolveWorkspaceDir` import/usage. Call parameterless agent-store functions. |
| `src/app/api/agents/[agentId]/route.ts` | Modify | Remove `resolveWorkspaceDir` import/usage. Call parameterless agent-store functions. |
| `src/app/api/threads/route.ts` | Modify | Change `loadAgents(workspaceDir)` → `loadAgents()`. Keep `resolveWorkspaceDir` for thread storage. |
| `src/app/api/threads/[threadId]/messages/route.ts` | Modify | Change `loadAgents(workspaceDir)` → `loadAgents()`. Keep `resolveWorkspaceDir` for thread storage. |
| `src/app/api/threads/[threadId]/stream/route.ts` | Modify | Change `loadAgents(workspaceDir)` → `loadAgents()`. Keep `resolveWorkspaceDir` for thread storage. |
| `src/components/SettingsDialog.tsx` | Modify | Remove `workspaceId` prop and `wsParam` usage from all fetch URLs. |
| `src/components/WorkspaceBar.tsx` | Modify | Add gear icon at top with `onOpenSettings` callback. |
| `src/components/ThreadList.tsx` | Modify | Remove settings footer. Remove `onOpenSettings` prop. Add gear icon to header on mobile. |
| `src/app/page.tsx` | Modify | Wire `onOpenSettings` to WorkspaceBar. Remove from ThreadList. Change `configUrl` to unconditional `/api/config`. Remove `workspaceId` prop from SettingsDialog. Pass `isMobile` and `onOpenSettings` to ThreadList for mobile gear icon. |

---

### Task 1: Make agent-store global

**Files:**
- Modify: `src/lib/agent-store.ts`

- [ ] **Step 1: Add `resolveGlobalConfigDir()` and migration logic**

Replace the `getConfigPath` function and update `loadConfig`/`saveConfig` to use the global path. Add migration that copies existing workspace config on first access.

```typescript
// At top of file, add os import (already imported) and path import (already imported)
// Replace getConfigPath and add resolveGlobalConfigDir:

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".entourage");
const GLOBAL_CONFIG_PATH = path.join(GLOBAL_CONFIG_DIR, "config.json");

let migrated = false;

async function migrateIfNeeded(): Promise<void> {
  if (migrated) return;
  try {
    await readFile(GLOBAL_CONFIG_PATH, "utf-8");
    migrated = true;
    return; // Already exists, no migration needed
  } catch {
    // Global config doesn't exist yet — try to migrate from first workspace
  }

  try {
    const wsRaw = await readFile(path.join(GLOBAL_CONFIG_DIR, "workspaces.json"), "utf-8");
    const wsData = JSON.parse(wsRaw) as { workspaces: { directory: string }[] };
    for (const ws of wsData.workspaces) {
      try {
        const localConfig = await readFile(path.join(ws.directory, ".entourage", "config.json"), "utf-8");
        // Validate it's real JSON before using it
        JSON.parse(localConfig);
        await mkdir(GLOBAL_CONFIG_DIR, { recursive: true });
        await writeFile(GLOBAL_CONFIG_PATH, localConfig);
        migrated = true;
        return;
      } catch {
        continue; // This workspace has no config, try next
      }
    }
  } catch {
    // No workspaces.json or can't read it — that's fine, will create default
  }
}
```

- [ ] **Step 2: Update `loadConfig` and `saveConfig` to use global path**

Remove the `workspaceDir` parameter from both functions:

```typescript
async function loadConfig(): Promise<Config> {
  await migrateIfNeeded();
  try {
    const raw = await readFile(GLOBAL_CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    const agents = DEFAULT_AGENTS.map((a) => ({ ...a, isDefault: true }));
    const config: Config = { agents };
    await saveConfig(config);
    return config;
  }
}

async function saveConfig(config: Config): Promise<void> {
  return withLock(async () => {
    await mkdir(GLOBAL_CONFIG_DIR, { recursive: true });
    await writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
  });
}
```

- [ ] **Step 3: Remove `workspaceDir` param from all exported functions**

Update every exported function signature. Remove the `workspaceDir` parameter and update internal calls:

- `loadAgents()` — was `loadAgents(workspaceDir: string)`
- `saveAgents(agents: Agent[])` — was `saveAgents(workspaceDir: string, agents: Agent[])`
- `loadDisplayName()` — was `loadDisplayName(workspaceDir: string)`
- `saveDisplayName(displayName: string)` — was `saveDisplayName(workspaceDir: string, displayName: string)`
- `createAgent(data: {...})` — was `createAgent(workspaceDir: string, data: {...})`
- `updateAgent(id: string, updates: ...)` — was `updateAgent(workspaceDir: string, id: string, updates: ...)`
- `deleteAgent(id: string)` — was `deleteAgent(workspaceDir: string, id: string)`
- `getAgent(id: string)` — was `getAgent(workspaceDir: string, id: string)`

Each function body just calls `loadConfig()` or `saveConfig(config)` without the dir param now.

- [ ] **Step 4: Delete the old `getConfigPath` function**

Remove the `getConfigPath(workspaceDir)` function entirely — it's replaced by the `GLOBAL_CONFIG_PATH` constant.

- [ ] **Step 5: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/agent-store.ts 2>&1 | head -20`

This will show type errors from callers (expected — we fix those in Task 2). The file itself should have no internal errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent-store.ts
git commit -m "refactor: make agent-store use global config at ~/.entourage/config.json"
```

---

### Task 2: Update API routes to use parameterless agent-store

**Files:**
- Modify: `src/app/api/config/route.ts`
- Modify: `src/app/api/agents/route.ts`
- Modify: `src/app/api/agents/[agentId]/route.ts`
- Modify: `src/app/api/threads/route.ts`
- Modify: `src/app/api/threads/[threadId]/messages/route.ts`
- Modify: `src/app/api/threads/[threadId]/stream/route.ts`

- [ ] **Step 1: Update `/api/config/route.ts`**

Remove `resolveWorkspaceDir` import. Remove `workspaceDir` variable. Call `loadAgents()`, `loadDisplayName()`, `saveDisplayName(displayName)` without workspace param. Remove `workingDirectory` from GET response.

```typescript
import { NextResponse } from "next/server";
import { loadAgents, loadDisplayName, saveDisplayName } from "@/lib/agent-store";

export async function GET() {
  const [agents, displayName] = await Promise.all([
    loadAgents(),
    loadDisplayName(),
  ]);
  return NextResponse.json({ agents, displayName });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  if (typeof body.displayName === "string") {
    await saveDisplayName(body.displayName.trim());
  }
  const displayName = await loadDisplayName();
  return NextResponse.json({ displayName });
}
```

- [ ] **Step 2: Update `/api/agents/route.ts`**

Remove `resolveWorkspaceDir` import. Call `loadAgents()` and `createAgent(data)` without workspace param.

```typescript
import { NextResponse } from "next/server";
import { loadAgents, createAgent } from "@/lib/agent-store";

export async function GET() {
  const agents = await loadAgents();
  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, model, avatarColor, icon, personality } = body;
  if (!name || !model || !avatarColor) {
    return NextResponse.json({ error: "name, model, and avatarColor are required" }, { status: 400 });
  }
  try {
    const agent = await createAgent({ name, model, avatarColor, icon, personality });
    return NextResponse.json(agent, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 3: Update `/api/agents/[agentId]/route.ts`**

Remove `resolveWorkspaceDir` import. Call `updateAgent(agentId, updates)` and `deleteAgent(agentId)` without workspace param.

```typescript
import { NextResponse } from "next/server";
import { updateAgent, deleteAgent } from "@/lib/agent-store";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const updates = await request.json();
  try {
    const agent = await updateAgent(agentId, updates);
    return NextResponse.json(agent);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  try {
    await deleteAgent(agentId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Update thread routes — change only `loadAgents()` calls**

In these three files, change `loadAgents(workspaceDir)` → `loadAgents()`. Keep `resolveWorkspaceDir` for thread storage operations.

**`src/app/api/threads/route.ts`** — line 22: `loadAgents(workspaceDir)` → `loadAgents()`

**`src/app/api/threads/[threadId]/messages/route.ts`** — line 32: `loadAgents(workspaceDir)` → `loadAgents()`

**`src/app/api/threads/[threadId]/stream/route.ts`** — line 29: `loadAgents(workspaceDir)` → `loadAgents()`

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No errors in modified API routes. May still have client-side errors (fixed in Task 3).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/config/route.ts src/app/api/agents/route.ts src/app/api/agents/\[agentId\]/route.ts src/app/api/threads/route.ts src/app/api/threads/\[threadId\]/messages/route.ts src/app/api/threads/\[threadId\]/stream/route.ts
git commit -m "refactor: update API routes for global config (drop workspaceDir from agent calls)"
```

---

### Task 3: Update client-side components for global settings

**Files:**
- Modify: `src/components/SettingsDialog.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Remove `workspaceId` from SettingsDialog**

In `src/components/SettingsDialog.tsx`:

1. Remove `workspaceId` from props type (line 33: delete `workspaceId?: string | null;`)
2. Remove `workspaceId` from destructured props (line 37: delete `workspaceId`)
3. Delete line 51: `const wsParam = workspaceId ? \`?workspaceId=${workspaceId}\` : "";`
4. Replace all `${wsParam}` occurrences with empty string in fetch URLs:
   - Line 54: `/api/agents${wsParam}` → `/api/agents`
   - Line 59: `/api/config${wsParam}` → `/api/config`
   - Line 75: `/api/config${wsParam}` → `/api/config`
   - Line 140: `/api/agents/${editingAgent.id}${wsParam}` → `/api/agents/${editingAgent.id}`
   - Line 146: `/api/agents${wsParam}` → `/api/agents`
   - Line 167: `/api/agents/${agent.id}${wsParam}` → `/api/agents/${agent.id}`

- [ ] **Step 2: Update `page.tsx` — global config fetch**

In `src/app/page.tsx`:

1. Line 134: Change `const configUrl = activeWorkspaceId ? wsUrl("/api/config") : null;` to `const configUrl = "/api/config";`
2. Line 419-426: Remove `workspaceId` prop from `<SettingsDialog>`:
   ```tsx
   <SettingsDialog
     open={showSettings}
     onClose={() => {
       setShowSettings(false);
       refetchConfig();
     }}
   />
   ```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsDialog.tsx src/app/page.tsx
git commit -m "refactor: remove workspaceId from settings client components"
```

---

### Task 4: Move settings gear from ThreadList to WorkspaceBar

**Files:**
- Modify: `src/components/WorkspaceBar.tsx`
- Modify: `src/components/ThreadList.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add gear icon to WorkspaceBar**

In `src/components/WorkspaceBar.tsx`:

1. Add `Settings` to lucide-react imports: `import { Plus, Pencil, Trash2, FolderOpen, Settings } from "lucide-react";`
2. Add `onOpenSettings: () => void;` to the `Props` type
3. Destructure `onOpenSettings` in the component params
4. Add gear button at the top of the `<div>`, before the workspace map. Place it above the workspaces with a separator:

```tsx
return (
  <div className="flex flex-col items-center w-16 bg-zinc-900 py-3 gap-2 flex-shrink-0">
    {/* Settings gear */}
    <button
      onClick={onOpenSettings}
      className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors ml-3"
      title="Settings"
    >
      <Settings size={20} />
    </button>

    {/* Separator */}
    <div className="w-8 h-px bg-zinc-700 my-1" />

    {workspaces.map((ws) => {
    // ... rest unchanged
```

- [ ] **Step 2: Remove settings footer from ThreadList, add mobile gear**

In `src/components/ThreadList.tsx`:

1. Update the props — remove `onOpenSettings: () => void;` and add `onOpenSettings?: () => void;` (optional, mobile only)
2. Remove the `Settings` import from lucide-react (line 6 — remove `Settings` from the import)
3. Delete the settings footer section (lines 264-272):
   ```tsx
   // DELETE THIS ENTIRE BLOCK:
   <div className="border-t border-zinc-200 dark:border-zinc-700 px-5 py-3">
     <button ...>
       <Settings ... />
       Settings
     </button>
   </div>
   ```
4. Add `Settings` back to imports (needed for mobile gear icon) — actually, re-add it since we need it for mobile
5. In the header section, add a gear icon button for mobile, next to the "+ New" button:

```tsx
<div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-5 py-4">
  <div className="flex items-center gap-2">
    <img src="/logo.png" alt="Entourage" className="h-7 w-7" />
    <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Entourage</h1>
  </div>
  <div className="flex items-center gap-2">
    {isMobile && onOpenSettings && (
      <button
        onClick={onOpenSettings}
        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>
    )}
    <button
      onClick={onNewThread}
      className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
    >
      + New
    </button>
  </div>
</div>
```

- [ ] **Step 3: Wire up props in `page.tsx`**

In `src/app/page.tsx`:

1. Add `onOpenSettings` to `<WorkspaceBar>` (line 394-401):
   ```tsx
   <WorkspaceBar
     workspaces={workspaces}
     activeWorkspaceId={activeWorkspaceId}
     onSelectWorkspace={handleSelectWorkspace}
     onAddWorkspace={() => setShowAddWorkspace(true)}
     onRemoveWorkspace={handleRemoveWorkspace}
     onEditWorkspace={handleEditWorkspace}
     onOpenSettings={() => setShowSettings(true)}
   />
   ```

2. Update the `threadListEl` (lines 337-349). Change `onOpenSettings` from required to optional (mobile-only):
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

   Note: Keep `onOpenSettings` in ThreadList — it's now only used on mobile but passing it always is harmless and simpler than conditionally providing it.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: No type errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`

Verify:
- Desktop: Gear icon visible at top of WorkspaceBar, opens settings dialog
- Desktop: No settings button at bottom of ThreadList
- Mobile (resize browser to <768px): Gear icon visible in ThreadList header next to "+ New"
- Settings dialog works: can view/edit agents and display name
- Settings persist across workspace switches (same agents in all workspaces)

- [ ] **Step 6: Commit**

```bash
git add src/components/WorkspaceBar.tsx src/components/ThreadList.tsx src/app/page.tsx
git commit -m "feat: move settings gear to WorkspaceBar, add mobile fallback in ThreadList header"
```

---

### Task 5: Build verification

- [ ] **Step 1: Run full build**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: No lint errors in modified files.

- [ ] **Step 3: Fix any issues found and commit**

If build or lint fails, fix and commit:

```bash
git add -A
git commit -m "fix: address build/lint issues from global settings migration"
```
