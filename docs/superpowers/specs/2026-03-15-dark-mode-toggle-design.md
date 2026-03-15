# Dark Mode Toggle — Design Spec

## Overview

Add a dark mode toggle to Nexus that respects the user's OS preference by default and allows manual override via a sun/moon icon button in the Settings dialog. Theme preference persists in `localStorage`.

## Decisions

- **Library:** `next-themes` — handles OS preference detection, `localStorage` persistence, FOUC prevention, and SSR hydration
- **Toggle location:** Inside `SettingsDialog.tsx` as a settings row
- **Toggle style:** Sun/moon icon button using `lucide-react` (`Sun`, `Moon`)
- **Toggle behavior:** Two-state (light/dark). Initial value comes from OS preference via `prefers-color-scheme`. Note: once toggled manually, user cannot return to "system" mode without clearing localStorage — this is an acceptable trade-off for simplicity.
- **Persistence:** `localStorage` (handled by `next-themes`)
- **Tailwind integration:** `dark:` variant keyed off `.dark` class on `<html>`
- **Color strategy:** Use CSS variables for base background/foreground (already in place). Use `dark:` utility classes for component-specific overrides where semantic variables don't apply.

## Architecture

### Theme Infrastructure

1. **Install `next-themes`** as a dependency
2. **Tailwind v4 dark mode config** — Add `@custom-variant dark (&:where(.dark, .dark *));` to `globals.css` to enable class-based dark mode (Tailwind v4 uses `prefers-color-scheme` by default; this overrides it to use the `.dark` class)
3. **`src/components/Providers.tsx`** (new client component) — Wraps children in `<ThemeProvider>` with:
   - `attribute="class"` (adds `dark` class to `<html>`)
   - `defaultTheme="system"` (respects OS preference)
   - `enableSystem={true}`
   - This is needed because `layout.tsx` is a Server Component (exports `metadata`/`viewport`), so `ThemeProvider` (a client component) cannot be used directly there
4. **`src/app/layout.tsx`** — Wrap body contents in `<Providers>`, add `suppressHydrationWarning` to `<html>` tag (prevents React hydration mismatch from `next-themes`' injected script)
5. **`src/app/globals.css`** — Add `.dark` selector with dark color variable overrides:
   - `--background: #0a0a0a` (zinc-950-ish)
   - `--foreground: #f4f4f5` (zinc-100)
   - Dark scrollbar colors
   - The existing `@theme inline` block does NOT need changes — it already references `var(--background)` and `var(--foreground)`, so the `.dark` override cascades through automatically

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
| Code blocks (markdown) | needs dark styling | add `dark:` background/text overrides to `<pre>`/`<code>` elements in the markdown renderer (plain CSS, no syntax highlighting library needed) |

### Toggle Component

- New row in `SettingsDialog.tsx`: "Theme" label on the left, icon button on the right
- Uses `useTheme()` hook from `next-themes` to read/set theme
- Shows `Moon` icon in light mode, `Sun` icon in dark mode
- Clicking toggles between `light` and `dark`

### Components Requiring Changes

**Infrastructure:**
- `package.json` — add `next-themes`
- `src/app/globals.css` — `@custom-variant`, `.dark` CSS variable overrides, dark scrollbar
- `src/components/Providers.tsx` — new client component wrapping `ThemeProvider`
- `src/app/layout.tsx` — use `<Providers>` wrapper, add `suppressHydrationWarning`

**Components (add `dark:` variants to existing classes):**
- `src/app/page.tsx` — main container
- `src/components/SettingsDialog.tsx` — toggle row + own dark variants
- `src/components/MessageBubble.tsx` — message backgrounds, text, code blocks
- `src/components/MessageInput.tsx` — input area
- `src/components/WorkspaceBar.tsx` — sidebar
- `src/components/ThreadList.tsx` — thread sidebar
- `src/components/ThreadDetail.tsx` — thread detail view
- `src/components/AddWorkspaceDialog.tsx` — dialog colors
- `src/components/NewThreadDialog.tsx` — dialog colors
- `src/components/IconPicker.tsx` — picker colors
- `src/components/AgentStatusBadge.tsx` — badge colors
- `src/components/ModelIcon.tsx` — icon colors (if applicable)

## Out of Scope

- Theme color customization beyond light/dark
- Per-workspace theme settings
- Animated transitions between themes (a minimal `transition: background-color 0.2s` could be added later at low cost)
- Three-state toggle (light/dark/system)
- PWA manifest `theme_color`/`background_color` dynamic updates
