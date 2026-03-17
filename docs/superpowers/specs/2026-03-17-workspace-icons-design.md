# Workspace Icons Design

**Date:** 2026-03-17
**Status:** Approved

## Summary

Add optional custom icons to workspaces — selectable from Lucide icons, emoji, or uploaded images. Icons display on the colored workspace button in the sidebar, with a live preview during configuration.

## Data Model

### Shared Icon Type

Rename `AgentIcon` to `Icon` and add an image variant:

```typescript
export type Icon =
  | { type: "lucide"; name: string }
  | { type: "emoji"; value: string }
  | { type: "image"; imageId: string; ext: string };
```

`AgentIcon` is removed. The `Agent` type's `icon` field changes from `AgentIcon` to `Icon` — same shape, just renamed.

### Workspace Type

Add an optional `icon` field:

```typescript
export type Workspace = {
  id: string;
  name: string;
  directory: string;
  color: string;
  addedAt: string;
  icon?: Icon;
};
```

Backward compatible — existing workspaces without `icon` continue showing initials.

## Storage

### Image Files

- **Location:** `~/.entourage/workspace-icons/<imageId>.<ext>`
- **`imageId`:** UUID generated on upload
- **Supported formats:** PNG, JPEG, GIF, WebP
- **Max size:** 2MB

### Cleanup

- When a workspace is deleted, delete its image icon file (if any) from `~/.entourage/workspace-icons/`.
- When an image icon is replaced with a different image, delete the old file.

## API

### New Routes

**`POST /api/workspace-icons`**
- Accepts multipart form data with a single image file
- Validates file type and size
- Saves to `~/.entourage/workspace-icons/<imageId>.<ext>`
- Returns `{ imageId, ext }`

**`GET /api/workspace-icons/[imageId]`**
- Serves the image file with appropriate `Content-Type` header
- Extension is known from the `Icon` type's `ext` field, passed as `?ext=` query param (avoids filesystem readdir on every request)

### Updated Routes

**`POST /api/workspaces`**
- Now accepts optional `icon` field in the request body

**`PATCH /api/workspaces/[workspaceId]`**
- Now accepts `icon` field in the request body (alongside existing `name` and `color`)

### WorkspaceStore Changes

- `addWorkspace()` — accepts optional `icon` parameter
- `updateWorkspace()` — update type constraint from `Partial<Pick<Workspace, "name" | "color">>` to `Partial<Pick<Workspace, "name" | "color" | "icon">>`
- Ensure `~/.entourage/workspace-icons/` directory is created on first image upload

## UI Components

### IconPicker

Add a third "Upload" tab alongside existing "Icons" and "Emoji" tabs:

- File input accepting image files (PNG, JPEG, GIF, WebP)
- On upload, calls `POST /api/workspace-icons`, receives `{ imageId, ext }`
- Emits `{ type: "image", imageId, ext }` through the existing `onSelect` callback

### renderIcon (renamed from renderAgentIcon)

Handles all three icon types:

- `type: "lucide"` — renders Lucide component (unchanged)
- `type: "emoji"` — renders span with emoji (unchanged)
- `type: "image"` — renders `<img>` tag pointing to `/api/workspace-icons/[imageId]` with `rounded-full object-cover` styling

All existing call sites updated to use `renderIcon`.

### AddWorkspaceDialog

- Add icon picker section below the color picker
- Show a live preview circle: colored background + selected icon (or initials if no icon set)
- Preview mirrors exactly how the workspace button looks in the sidebar

### WorkspaceBar

**Icon rendering:**
- When `ws.icon` exists, render the icon inside the colored circle instead of initials
- When no icon, fall back to current initials behavior
- Colored background always shows behind the icon for all icon types

**Context menu additions:**
- "Change Icon" — closes the context menu, then opens a separate IconPicker popover anchored to the workspace button
- "Remove Icon" — shown only when an icon is set; clears the icon directly

The `onEditWorkspace` callback type expands from `{ name?: string; color?: string }` to also accept `icon?: Icon | null` (where `null` means remove icon).

## Backward Compatibility

- `icon` field is optional on `Workspace` — no migration needed
- `AgentIcon` → `Icon` is a pure rename; no behavior change
- `renderAgentIcon` → `renderIcon` — all call sites updated
- Existing workspaces without icons render identically to today
