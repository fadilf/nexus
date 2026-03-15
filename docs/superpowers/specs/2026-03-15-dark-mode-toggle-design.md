# Dark Mode Toggle — Design Spec

## Overview

Add a dark mode toggle to Nexus that respects the user's OS preference by default and allows manual override via a sun/moon icon button in the Settings dialog. Theme preference persists in `localStorage`.

## Decisions

- **Library:** `next-themes` — handles OS preference detection, `localStorage` persistence, FOUC prevention, and SSR hydration
- **Toggle location:** Inside `SettingsDialog.tsx` as a settings row
- **Toggle style:** Sun/moon icon button using `lucide-react` (`Sun`, `Moon`)
- **Toggle behavior:** Two-state (light/dark). Initial value comes from OS preference via `prefers-color-scheme`
- **Persistence:** `localStorage` (handled by `next-themes`)
- **Tailwind integration:** `dark:` variant keyed off `.dark` class on `<html>`

## Architecture

### Theme Infrastructure

1. **Install `next-themes`** as a dependency
2. **`src/app/layout.tsx`** — Wrap app in `<ThemeProvider>` with:
   - `attribute="class"` (adds `dark` class to `<html>`)
   - `defaultTheme="system"` (respects OS preference)
   - `enableSystem={true}`
3. **`src/app/globals.css`** — Add `.dark` selector with dark color variable overrides:
   - `--background: #0a0a0a` (zinc-950-ish)
   - `--foreground: #f4f4f5` (zinc-100)
   - Dark scrollbar colors

### Color Mapping

| Element | Light | Dark |
|---------|-------|------|
| Page background | `bg-white` | `dark:bg-zinc-900` |
| Primary text | `text-zinc-900` | `dark:text-zinc-100` |
| Secondary text | `text-zinc-500`/`600` | `dark:text-zinc-400` |
| Cards/panels | `bg-zinc-50`/`100` | `dark:bg-zinc-800` |
| Borders | `border-zinc-200` | `dark:border-zinc-700` |
| Hover states | `hover:bg-zinc-100` | `dark:hover:bg-zinc-700` |
| Modal overlay | `bg-black/40` | unchanged |
| Accent (violet) | unchanged | unchanged |
| Scrollbar | `#d4d4d8` | dark equivalent via CSS variable |

### Toggle Component

- New row in `SettingsDialog.tsx`: "Theme" label on the left, icon button on the right
- Uses `useTheme()` hook from `next-themes` to read/set theme
- Shows `Moon` icon in light mode, `Sun` icon in dark mode
- Clicking toggles between `light` and `dark`

### Components Requiring Changes

**Infrastructure:**
- `package.json` — add `next-themes`
- `src/app/globals.css` — `.dark` CSS variable overrides, dark scrollbar
- `src/app/layout.tsx` — `<ThemeProvider>` wrapper

**Components (add `dark:` variants to existing classes):**
- `src/app/page.tsx` — main container
- `src/components/SettingsDialog.tsx` — toggle row + own dark variants
- `src/components/MessageBubble.tsx` — message backgrounds, text
- `src/components/WorkspaceBar.tsx` — sidebar
- All dialog components (`AddAgentDialog`, `AddWorkspaceDialog`, `EditWorkspaceDialog`, `DeleteConfirmDialog`)
- `src/components/ChatInput.tsx` — input area
- `src/components/ThreadList.tsx` — thread sidebar
- Any other components with hardcoded zinc/white color classes

## Out of Scope

- Theme color customization beyond light/dark
- Per-workspace theme settings
- Animated transitions between themes
- Three-state toggle (light/dark/system)
