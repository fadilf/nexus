# Workspace Icons Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional custom icons (Lucide, emoji, or uploaded image) to workspaces, displayed on the sidebar workspace buttons with a live preview during configuration.

**Architecture:** Extend the existing `AgentIcon` type into a shared `Icon` type with a new `image` variant. Reuse the existing `IconPicker` component (add an Upload tab). Serve uploaded images via new API routes, store them globally at `~/.entourage/workspace-icons/`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-17-workspace-icons-design.md`

---

### Task 1: Rename `AgentIcon` → `Icon` and add image variant

**Files:**
- Modify: `src/lib/types.ts:3-5` (rename type, add image variant)
- Modify: `src/lib/types.ts:12` (Agent.icon type)
- Modify: `src/lib/types.ts:73-79` (Workspace type — add icon field)
- Modify: `src/components/IconPicker.tsx:12,26,39-40` (import + function signatures)
- Modify: `src/components/ModelIcon.tsx:1-2,15,19` (import + props)
- Modify: `src/components/MessageBubble.tsx:3,49` (import + props)
- Modify: `src/components/SettingsDialog.tsx:4,14` (import + form type)

- [ ] **Step 1: Update `types.ts`**

In `src/lib/types.ts`, rename `AgentIcon` to `Icon`, add the `image` variant, update `Agent.icon`, and add `icon` to `Workspace`:

```typescript
export type Icon =
  | { type: "lucide"; name: string }
  | { type: "emoji"; value: string }
  | { type: "image"; imageId: string; ext: string };
```

Change line 12 from `icon?: AgentIcon` to `icon?: Icon`.

Add `icon?: Icon` to the `Workspace` type after `addedAt`.

- [ ] **Step 2: Update `IconPicker.tsx`**

In `src/components/IconPicker.tsx`:
- Change import from `AgentIcon` to `Icon` (use `import type { Icon }` to avoid conflict with the local `Icon` variable in the grid)
- Rename `renderAgentIcon` to `renderIcon`
- Rename the local `const Icon = ICON_MAP[name]` variable on line 84 to `const LucideComp = ICON_MAP[name]` (and update `<Icon className=.../>` to `<LucideComp className=.../>` on line 98) to avoid shadowing the `Icon` type
- Add image rendering case to `renderIcon`:

```typescript
export function renderIcon(icon: Icon, className: string = "h-4 w-4") {
  if (icon.type === "emoji") {
    return <span className={className} style={{ fontSize: "1em", lineHeight: 1 }}>{icon.value}</span>;
  }
  if (icon.type === "image") {
    return <img src={`/api/workspace-icons/${icon.imageId}?ext=${icon.ext}`} alt="" className={`${className} rounded-full object-cover`} />;
  }
  const IconComponent = ICON_MAP[icon.name];
  if (!IconComponent) return <Bot className={className} />;
  return <IconComponent className={className} />;
}
```

Update `IconPicker` props from `AgentIcon` to `Icon`:

```typescript
export default function IconPicker({
  value,
  onChange,
}: {
  value?: Icon;
  onChange: (icon: Icon) => void;
}) {
```

- [ ] **Step 3: Update all `AgentIcon`/`renderAgentIcon` call sites**

In `src/components/ModelIcon.tsx`:
- Change import to `import { AgentModel, Icon } from "@/lib/types";`
- Change import to `import { renderIcon } from "./IconPicker";`
- Change prop type from `icon?: AgentIcon` to `icon?: Icon`
- Change call from `renderAgentIcon(icon, className)` to `renderIcon(icon, className)`

In `src/components/MessageBubble.tsx`:
- Change import from `AgentIcon` to `Icon`
- Change prop type from `icon?: AgentIcon` to `icon?: Icon`

In `src/components/SettingsDialog.tsx`:
- Change import from `AgentIcon` to `Icon`
- Change form type from `icon?: AgentIcon` to `icon?: Icon`

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no type errors. All existing functionality unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/components/IconPicker.tsx src/components/ModelIcon.tsx src/components/MessageBubble.tsx src/components/SettingsDialog.tsx
git commit -m "refactor: rename AgentIcon to Icon and add image variant"
```

---

### Task 2: Workspace icon upload API route

**Files:**
- Create: `src/app/api/workspace-icons/route.ts`

- [ ] **Step 1: Create the POST route**

Create `src/app/api/workspace-icons/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

const ICONS_DIR = path.join(os.homedir(), ".entourage", "workspace-icons");
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mime] ?? "png";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type: ${file.type}. Allowed: png, jpg, gif, webp` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Max 2MB" },
      { status: 400 }
    );
  }

  await mkdir(ICONS_DIR, { recursive: true });

  const imageId = crypto.randomUUID();
  const ext = extFromMime(file.type);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(ICONS_DIR, `${imageId}.${ext}`), buffer);

  return NextResponse.json({ imageId, ext });
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/workspace-icons/route.ts
git commit -m "feat: add workspace icon upload API route"
```

---

### Task 3: Workspace icon serve API route

**Files:**
- Create: `src/app/api/workspace-icons/[imageId]/route.ts`

- [ ] **Step 1: Create the GET route**

Create `src/app/api/workspace-icons/[imageId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import os from "os";

const ICONS_DIR = path.join(os.homedir(), ".entourage", "workspace-icons");
const VALID_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;
  const url = new URL(request.url);
  const ext = url.searchParams.get("ext") || "png";

  if (!VALID_EXTS.has(ext)) {
    return NextResponse.json({ error: "Invalid extension" }, { status: 400 });
  }

  // Validate imageId is a UUID to prevent path traversal
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(imageId)) {
    return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
  }

  try {
    const filePath = path.join(ICONS_DIR, `${imageId}.${ext}`);
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": MIME_MAP[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Icon not found" }, { status: 404 });
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/workspace-icons/\[imageId\]/route.ts
git commit -m "feat: add workspace icon serve API route"
```

---

### Task 4: Update WorkspaceStore and workspace API routes

**Files:**
- Modify: `src/lib/workspace-store.ts:33,59` (addWorkspace and updateWorkspace signatures)
- Modify: `src/app/api/workspaces/route.ts:11-15` (POST body parsing)
- Modify: `src/app/api/workspaces/[workspaceId]/route.ts:4-17` (PATCH — icon cleanup on replace)

- [ ] **Step 1: Update `workspace-store.ts`**

In `src/lib/workspace-store.ts`:

Update `addWorkspace` signature to accept optional `icon`:

```typescript
import { Workspace, Icon } from "./types";
```

```typescript
export async function addWorkspace(directory: string, name?: string, color?: string, icon?: Icon): Promise<Workspace> {
```

Add `icon` to the workspace object creation (line ~45, after `addedAt`):

```typescript
  const workspace: Workspace = {
    id: crypto.randomUUID(),
    name: name || path.basename(directory),
    directory,
    color: color || COLORS[data.workspaces.length % COLORS.length],
    addedAt: new Date().toISOString(),
    ...(icon && { icon }),
  };
```

Update `updateWorkspace` type constraint:

```typescript
export async function updateWorkspace(id: string, updates: Partial<Pick<Workspace, "name" | "color" | "icon">>): Promise<Workspace> {
```

- [ ] **Step 2: Update `POST /api/workspaces`**

In `src/app/api/workspaces/route.ts`, update the body parsing to include `icon`:

```typescript
import { Icon } from "@/lib/types";
```

```typescript
  const { directory, name, color, icon } = (await request.json()) as {
    directory: string;
    name?: string;
    color?: string;
    icon?: Icon;
  };
```

Pass `icon` to `addWorkspace`:

```typescript
    const workspace = await addWorkspace(directory, name, color, icon);
```

- [ ] **Step 3: Update `PATCH /api/workspaces/[workspaceId]` with icon cleanup**

In `src/app/api/workspaces/[workspaceId]/route.ts`, add cleanup logic for replaced image icons:

```typescript
import { NextResponse } from "next/server";
import { removeWorkspace, updateWorkspace, loadWorkspaces } from "@/lib/workspace-store";
import { unlink } from "fs/promises";
import path from "path";
import os from "os";

const ICONS_DIR = path.join(os.homedir(), ".entourage", "workspace-icons");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const updates = await request.json();

  try {
    // If icon is changing, clean up the old image file
    if ("icon" in updates) {
      const workspaces = await loadWorkspaces();
      const existing = workspaces.find((w) => w.id === workspaceId);
      if (existing?.icon?.type === "image") {
        const oldPath = path.join(ICONS_DIR, `${existing.icon.imageId}.${existing.icon.ext}`);
        await unlink(oldPath).catch(() => {});
      }
    }

    const workspace = await updateWorkspace(workspaceId, updates);
    return NextResponse.json(workspace);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Add icon cleanup on workspace DELETE**

In the same file, update the DELETE handler:

```typescript
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  try {
    // Clean up image icon file if present
    const workspaces = await loadWorkspaces();
    const existing = workspaces.find((w) => w.id === workspaceId);
    if (existing?.icon?.type === "image") {
      const iconPath = path.join(ICONS_DIR, `${existing.icon.imageId}.${existing.icon.ext}`);
      await unlink(iconPath).catch(() => {});
    }

    await removeWorkspace(workspaceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/workspace-store.ts src/app/api/workspaces/route.ts src/app/api/workspaces/\[workspaceId\]/route.ts
git commit -m "feat: support icon field in workspace store and API routes"
```

---

### Task 5: Add Upload tab to IconPicker

**Files:**
- Modify: `src/components/IconPicker.tsx:35-128` (add Upload tab and upload logic)

- [ ] **Step 1: Add Upload tab to IconPicker**

In `src/components/IconPicker.tsx`, update the component to add a third "Upload" tab. Add `Upload` import from lucide-react.

Add an `enableUpload` prop (default `false`) so only workspace icon pickers show the upload tab — agent icon pickers don't need it:

```typescript
export default function IconPicker({
  value,
  onChange,
  enableUpload = false,
}: {
  value?: Icon;
  onChange: (icon: Icon) => void;
  enableUpload?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"lucide" | "emoji" | "upload">(
    value?.type === "emoji" ? "emoji" : value?.type === "image" ? "upload" : "lucide"
  );
  const [emojiInput, setEmojiInput] = useState(value?.type === "emoji" ? value.value : "");
  const [uploading, setUploading] = useState(false);
```

Add an "Upload" tab button after the "Emoji" button (only when `enableUpload` is true):

```typescript
        {enableUpload && (
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`rounded px-2 py-1 text-xs font-medium ${
              mode === "upload" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
            }`}
          >
            Upload
          </button>
        )}
```

Restructure the existing ternary. The current code is `{mode === "lucide" ? (...lucide panel...) : (...emoji panel...)}`. Change it to `{mode === "lucide" ? (...lucide panel...) : mode === "upload" ? (...upload panel...) : (...emoji panel...)}`. Specifically, find the `) : (` before the emoji `<div className="flex items-center gap-2">` and replace it with `) : mode === "upload" ? (...upload panel...) : (`:

```typescript
      ) : mode === "upload" ? (
        <div className="space-y-2">
          {value?.type === "image" && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <img
                src={`/api/workspace-icons/${value.imageId}?ext=${value.ext}`}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
              <span>Current image</span>
            </div>
          )}
          <label className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 p-4 cursor-pointer hover:border-violet-400 dark:hover:border-violet-500 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {uploading ? "Uploading..." : "Choose image (PNG, JPG, GIF, WebP)"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const formData = new FormData();
                  formData.append("file", file);
                  const res = await fetch("/api/workspace-icons", { method: "POST", body: formData });
                  if (!res.ok) {
                    const data = await res.json();
                    alert(data.error || "Upload failed");
                    return;
                  }
                  const { imageId, ext } = await res.json();
                  onChange({ type: "image", imageId, ext });
                } catch {
                  alert("Upload failed");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Max 2MB</p>
        </div>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/IconPicker.tsx
git commit -m "feat: add Upload tab to IconPicker for image icons"
```

---

### Task 6: Add icon picker and preview to AddWorkspaceDialog

**Files:**
- Modify: `src/components/AddWorkspaceDialog.tsx`

- [ ] **Step 1: Add icon state and picker to the dialog**

In `src/components/AddWorkspaceDialog.tsx`:

Add imports:

```typescript
import { Icon } from "@/lib/types";
import IconPicker, { renderIcon } from "./IconPicker";
```

Add icon state:

```typescript
  const [icon, setIcon] = useState<Icon | undefined>(undefined);
```

Add `icon` to the form submit body (in `handleSubmit`):

```typescript
        body: JSON.stringify({
          directory: directory.trim(),
          name: name.trim() || undefined,
          color,
          icon,
        }),
```

Reset `icon` on successful submit:

```typescript
      setIcon(undefined);
```

Update `onAdded` prop type to use `Workspace`:

```typescript
import { Workspace, Icon } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (workspace: Workspace) => void;
  inline?: boolean;
};
```

- [ ] **Step 2: Add icon picker section and preview to form**

After the Color section in the form, add:

```typescript
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Icon <span className="text-zinc-400 dark:text-zinc-500">(optional)</span>
          </label>

          {/* Live preview */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {icon ? (
                renderIcon(icon, "h-5 w-5")
              ) : (
                <span>{getInitials(name || directory.split("/").pop() || "WS")}</span>
              )}
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">Preview</span>
          </div>

          <IconPicker
            value={icon}
            onChange={setIcon}
            enableUpload
          />
          {icon && (
            <button
              type="button"
              onClick={() => setIcon(undefined)}
              className="mt-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Remove icon
            </button>
          )}
        </div>
```

Add the `getInitials` helper (same as in WorkspaceBar) inside the component:

```typescript
  const getInitials = (name: string) => {
    const words = name.split(/[\s-_]+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddWorkspaceDialog.tsx
git commit -m "feat: add icon picker and live preview to AddWorkspaceDialog"
```

---

### Task 7: Render workspace icons in WorkspaceBar

**Files:**
- Modify: `src/components/WorkspaceBar.tsx`

- [ ] **Step 1: Add icon rendering to workspace buttons**

In `src/components/WorkspaceBar.tsx`:

Add imports:

```typescript
import { Workspace, Icon } from "@/lib/types";
import { renderIcon } from "./IconPicker";
```

In the workspace button (around line 118-119), replace the initials-only rendering with icon-aware rendering:

```typescript
              <button
                onClick={() => onSelectWorkspace(ws.id)}
                onContextMenu={(e) => handleContextMenu(e, ws.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold text-white ml-3 transition-all duration-200 ${
                  isActive
                    ? "rounded-2xl shadow-lg shadow-black/30 scale-105"
                    : "hover:rounded-2xl hover:brightness-110"
                }`}
                style={{ backgroundColor: ws.color }}
                title={`${ws.name}\n${ws.directory}`}
              >
                {ws.icon ? renderIcon(ws.icon, "h-5 w-5") : getInitials(ws.name)}
              </button>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. Workspaces without icons still show initials.

- [ ] **Step 3: Commit**

```bash
git add src/components/WorkspaceBar.tsx
git commit -m "feat: render workspace icons in WorkspaceBar"
```

---

### Task 8: Add "Change Icon" and "Remove Icon" to context menu

**Files:**
- Modify: `src/components/WorkspaceBar.tsx` (context menu, icon picker popover, callback type)
- Modify: `src/app/page.tsx:254-255` (handleEditWorkspace callback type)

- [ ] **Step 1: Update `onEditWorkspace` callback type**

In `src/components/WorkspaceBar.tsx`, update the Props type:

```typescript
  onEditWorkspace: (id: string, updates: { name?: string; color?: string; icon?: Icon | null }) => void;
```

In `src/app/page.tsx`, update `handleEditWorkspace` (line 255):

```typescript
  const handleEditWorkspace = useCallback(
    async (id: string, updates: { name?: string; color?: string; icon?: Icon | null }) => {
```

Add `Icon` to the import in `page.tsx` if not already present:

```typescript
import { ..., Icon } from "@/lib/types";
```

- [ ] **Step 2: Add icon picker popover state to WorkspaceBar**

Add state for the icon picker popover:

```typescript
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const wsButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
```

Add a click-outside handler for the icon picker popover (alongside the existing context menu handler):

```typescript
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setIconPickerFor(null);
      }
    };
    if (iconPickerFor) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [iconPickerFor]);
```

Store refs to workspace buttons (add `ref` callback to the button element):

```typescript
                ref={(el) => { if (el) wsButtonRefs.current.set(ws.id, el); }}
```

- [ ] **Step 3: Add context menu items**

After the "Rename" button and before the directory button in the context menu, add:

```typescript
          <button
            className="w-full px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2 text-left"
            onClick={() => {
              setContextMenu(null);
              setIconPickerFor(contextMenu.id);
            }}
          >
            <Palette size={14} />
            Change Icon
          </button>
          {workspaces.find((w) => w.id === contextMenu.id)?.icon && (
            <button
              className="w-full px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2 text-left"
              onClick={() => {
                onEditWorkspace(contextMenu.id, { icon: null });
                setContextMenu(null);
              }}
            >
              <Trash2 size={14} />
              Remove Icon
            </button>
          )}
```

Update the lucide-react import on line 5 to add `Palette`:

```typescript
import { Plus, Pencil, Trash2, FolderOpen, Settings, Palette } from "lucide-react";
```

Add `IconPicker` and `renderIcon` imports (if not already added in Task 7):

```typescript
import IconPicker, { renderIcon } from "./IconPicker";
```

- [ ] **Step 4: Add icon picker popover**

After the context menu portal, add the icon picker popover portal:

```typescript
      {iconPickerFor && createPortal(
        <div
          ref={iconPickerRef}
          className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-3 w-72"
          style={{
            left: 72,
            top: (() => {
              const btn = wsButtonRefs.current.get(iconPickerFor);
              if (!btn) return 100;
              const rect = btn.getBoundingClientRect();
              return Math.min(rect.top, window.innerHeight - 350);
            })(),
          }}
        >
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Workspace Icon</div>
          <IconPicker
            value={workspaces.find((w) => w.id === iconPickerFor)?.icon}
            onChange={(icon) => {
              onEditWorkspace(iconPickerFor, { icon });
              setIconPickerFor(null);
            }}
            enableUpload
          />
        </div>,
        document.body
      )}
```

- [ ] **Step 5: Handle `icon: null` in page.tsx `handleEditWorkspace`**

In `src/app/page.tsx`, the `handleEditWorkspace` callback sends updates to the PATCH API. When `icon` is `null`, we need to send it so the backend clears the icon. The current code already spreads `updates` into the JSON body, so `{ icon: null }` will be sent correctly.

In `workspace-store.ts` `updateWorkspace`, when `icon` is `null`, we need to delete it from the workspace object. Update the function to use a `WorkspaceUpdates` type for clarity:

```typescript
type WorkspaceUpdates = { name?: string; color?: string; icon?: Icon | null };

export async function updateWorkspace(id: string, updates: WorkspaceUpdates): Promise<Workspace> {
  const data = await loadData();
  const idx = data.workspaces.findIndex((w) => w.id === id);
  if (idx === -1) throw new Error("Workspace not found");

  const { icon, ...rest } = updates;
  data.workspaces[idx] = { ...data.workspaces[idx], ...rest };
  if (icon === null) {
    delete data.workspaces[idx].icon;
  } else if (icon !== undefined) {
    data.workspaces[idx].icon = icon;
  }
  await saveData(data);
  return data.workspaces[idx];
}
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/WorkspaceBar.tsx src/app/page.tsx src/lib/workspace-store.ts
git commit -m "feat: add Change Icon and Remove Icon to workspace context menu"
```

---

### Task 9: Manual verification

- [ ] **Step 1: Start dev server and test**

Run: `npm run dev`

Test the following manually:
1. Existing workspaces still show colored initials (backward compat)
2. Add new workspace with a Lucide icon — preview shows icon on colored background
3. Add new workspace with an emoji — preview shows emoji on colored background
4. Add new workspace with an uploaded image — preview shows image on colored background
5. Workspace bar renders all icon types correctly
6. Right-click workspace → "Change Icon" opens icon picker popover
7. Select a new icon via the popover — workspace updates immediately
8. Right-click workspace with icon → "Remove Icon" clears back to initials
9. Agent icons in settings/chat still work (no regression from rename)

- [ ] **Step 2: Final build check**

Run: `npm run build && npm run lint`
Expected: Both pass cleanly.

- [ ] **Step 3: Commit any fixes**

If any issues found during testing, fix and commit.
