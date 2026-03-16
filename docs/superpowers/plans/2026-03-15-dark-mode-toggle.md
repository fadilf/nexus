# Dark Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark mode toggle to Entourage that respects OS preference, persists via localStorage, and is toggled from the Settings dialog.

**Architecture:** Install `next-themes` to manage theme state. Create a `Providers.tsx` client component wrapper. Add `dark:` Tailwind variants to all components with hardcoded light-mode colors. Toggle lives in `SettingsDialog.tsx`.

**Tech Stack:** next-themes, Tailwind CSS v4 (`@custom-variant`), lucide-react (Sun/Moon icons)

**Spec:** `docs/superpowers/specs/2026-03-15-dark-mode-toggle-design.md`

---

## Chunk 1: Theme Infrastructure

### Task 1: Install next-themes

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run: `npm install next-themes`

- [ ] **Step 2: Verify installation**

Run: `grep next-themes package.json`
Expected: `"next-themes": "^0.x.x"` in dependencies

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install next-themes for dark mode support"
```

### Task 2: Configure Tailwind v4 dark mode and CSS variables

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add custom variant and dark CSS variables**

Replace the entire `src/app/globals.css` with:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #ffffff;
  --foreground: #171717;
}

.dark {
  --background: #0a0a0a;
  --foreground: #f4f4f5;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), sans-serif;
}

* {
  scrollbar-width: thin;
  scrollbar-color: #d4d4d8 transparent;
}

.dark * {
  scrollbar-color: #52525b transparent;
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add Tailwind v4 dark mode config and CSS variables"
```

### Task 3: Create Providers wrapper and update layout

**Files:**
- Create: `src/components/Providers.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create Providers.tsx**

Create `src/components/Providers.tsx`:

```tsx
"use client";

import { ThemeProvider } from "next-themes";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Update layout.tsx**

Modify `src/app/layout.tsx` — add `suppressHydrationWarning` to `<html>` and wrap `{children}` in `<Providers>`:

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Entourage",
  description: "Thread-based messaging client",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Entourage",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/Providers.tsx src/app/layout.tsx
git commit -m "feat: add ThemeProvider wrapper for dark mode"
```

## Chunk 2: Theme Toggle in Settings

### Task 4: Add theme toggle to SettingsDialog

**Files:**
- Modify: `src/components/SettingsDialog.tsx`

- [ ] **Step 1: Add theme toggle row**

At the top of the file, add imports:

```tsx
import { ArrowLeft, Pencil, Trash2, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
```

Inside the component function, add after the existing state declarations:

```tsx
const { theme, setTheme, resolvedTheme } = useTheme();
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
```

In the settings list view (the `else` branch of `showForm`), add a theme toggle section **before** the "Agent Profiles" heading. Insert right after `<div className="space-y-1">`:

```tsx
{/* Theme toggle */}
<div className="flex items-center justify-between px-3 py-2.5 mb-3">
  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Theme</span>
  {mounted && (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )}
</div>
<div className="border-b border-zinc-200 dark:border-zinc-700 mb-3" />
```

- [ ] **Step 2: Verify the toggle renders**

Run: `npm run dev` and open Settings dialog. The theme toggle should appear above the agent profiles section.

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsDialog.tsx
git commit -m "feat: add theme toggle to Settings dialog"
```

## Chunk 3: Dark mode variants for all components

> **Implementation notes:**
> - Line numbers are approximate — search for the class strings rather than relying on exact line positions.
> - When a find string appears multiple times in a file (noted in the table), use **replace all** to update every occurrence.
> - Some replacements add new classes (e.g., `bg-white dark:bg-zinc-700`) where the original had no explicit background. This is intentional.

### Task 5: Add dark variants to page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update main container classes**

Find (appears twice — lines 357 and 370):
```
bg-white text-zinc-900
```

Replace with:
```
bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add dark mode variants to page.tsx"
```

### Task 6: Add dark variants to SettingsDialog.tsx

**Files:**
- Modify: `src/components/SettingsDialog.tsx`

- [ ] **Step 1: Update all hardcoded color classes**

Apply these replacements throughout `SettingsDialog.tsx`:

| Find | Replace |
|------|---------|
| `bg-white shadow-xl` (dialog container, line 147) | `bg-white dark:bg-zinc-800 shadow-xl` |
| `border-b border-zinc-200` (header border, line 149) | `border-b border-zinc-200 dark:border-zinc-700` |
| `text-zinc-500 hover:text-zinc-700` (back button, line 152) | `text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200` |
| `text-lg font-semibold text-zinc-900` (title, line 156) | `text-lg font-semibold text-zinc-900 dark:text-zinc-100` |
| `text-zinc-400 hover:text-zinc-600 text-xl` (close button, line 165) | `text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 text-xl` |
| `bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200` (error, lines 177 and 294) | `bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800` |
| `text-sm font-medium text-zinc-700` (labels, lines 184, 197, 219, 244, 255) | `text-sm font-medium text-zinc-700 dark:text-zinc-300` |
| `border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500` (text inputs, lines 190, 261) | `border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500` |
| `bg-zinc-900 text-white` (active model button, line 206) | `bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900` |
| `bg-zinc-100 text-zinc-600 hover:bg-zinc-200` (inactive model button, line 207) | `bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600` |
| `ring-2 ring-offset-2 ring-zinc-900` (selected color, line 227) | `ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 dark:ring-offset-zinc-800` |
| `w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900` (hex input, line 236) | `w-20 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-100` |
| `text-sm text-zinc-600 hover:bg-zinc-100` (cancel button, line 268) | `text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700` |
| `bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800` (save button, line 275) | `bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200` |
| `text-sm font-medium text-zinc-700` (Agent Profiles heading, line 284) | `text-sm font-medium text-zinc-700 dark:text-zinc-300` |
| `bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800` (Add Agent button, line 287) | `bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200` |
| `hover:bg-zinc-50` (agent row hover, line 302) | `hover:bg-zinc-50 dark:hover:bg-zinc-700` |
| `bg-white` (agent avatar, line 305) | `bg-white dark:bg-zinc-800` |
| `text-sm font-medium text-zinc-900` (agent name, line 314) | `text-sm font-medium text-zinc-900 dark:text-zinc-100` |
| `text-xs text-zinc-500` (agent model, line 315) | `text-xs text-zinc-500 dark:text-zinc-400` |
| `text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600` (edit icon, line 324) | `text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300` |
| `text-zinc-400 hover:bg-red-50 hover:text-red-500` (delete icon, line 332) | `text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30` |

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsDialog.tsx
git commit -m "feat: add dark mode variants to SettingsDialog"
```

### Task 7: Add dark variants to MessageBubble.tsx

**Files:**
- Modify: `src/components/MessageBubble.tsx`

- [ ] **Step 1: Update color classes**

Apply these replacements:

| Find | Replace |
|------|---------|
| `bg-zinc-100` (agent avatar, line 55) | `bg-zinc-100 dark:bg-zinc-800` |
| `text-xs text-zinc-500` (agent name, line 75) | `text-xs text-zinc-500 dark:text-zinc-400` |
| `text-zinc-400` (model name dot, line 78) | `text-zinc-400 dark:text-zinc-500` |
| `bg-red-50 text-red-900 border border-red-200` (error message, line 105) | `bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-400 border border-red-200 dark:border-red-800` |
| `bg-zinc-100 text-zinc-900` (agent message bubble, line 106) | `bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100` |
| `text-violet-600` (mention in agent msg, line 25) | `text-violet-600 dark:text-violet-400` |
| `block bg-zinc-800 text-zinc-100 rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto whitespace-pre` (code block, line 126) | `block bg-zinc-800 dark:bg-zinc-900 text-zinc-100 rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto whitespace-pre` |
| `bg-zinc-200 text-zinc-800 rounded px-1 py-0.5 text-xs font-mono` (inline code, line 130) | `bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded px-1 py-0.5 text-xs font-mono` |
| `text-violet-600 underline hover:text-violet-800` (link, line 135) | `text-violet-600 dark:text-violet-400 underline hover:text-violet-800 dark:hover:text-violet-300` |
| `border-l-2 border-zinc-300 pl-3 my-2 text-zinc-600 italic` (blockquote, line 140) | `border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 my-2 text-zinc-600 dark:text-zinc-400 italic` |
| `border border-zinc-300 px-2 py-1 bg-zinc-200 font-semibold text-left` (th, line 147) | `border border-zinc-300 dark:border-zinc-600 px-2 py-1 bg-zinc-200 dark:bg-zinc-700 font-semibold text-left` |
| `border border-zinc-300 px-2 py-1` (td, line 148) | `border border-zinc-300 dark:border-zinc-600 px-2 py-1` |
| `my-2 border-zinc-300` (hr, line 149) | `my-2 border-zinc-300 dark:border-zinc-600` |
| `text-xs text-zinc-400 italic` (reconnecting, line 158) | `text-xs text-zinc-400 dark:text-zinc-500 italic` |
| `text-[11px] text-zinc-400` (timestamp, line 166) | `text-[11px] text-zinc-400 dark:text-zinc-500` |

- [ ] **Step 2: Commit**

```bash
git add src/components/MessageBubble.tsx
git commit -m "feat: add dark mode variants to MessageBubble"
```

### Task 8: Add dark variants to MessageInput.tsx

**Files:**
- Modify: `src/components/MessageInput.tsx`

- [ ] **Step 1: Update color classes**

Apply these replacements:

| Find | Replace |
|------|---------|
| `border-t border-zinc-200` (container, line 199) | `border-t border-zinc-200 dark:border-zinc-700` |
| `bg-violet-50` (drag over state, line 199) | `bg-violet-50 dark:bg-violet-900/20` |
| `border-2 border-dashed border-violet-400 bg-violet-50/80` (drag overlay, line 205) | `border-2 border-dashed border-violet-400 bg-violet-50/80 dark:bg-violet-900/40` |
| `text-sm font-medium text-violet-600` (drop text, line 206) | `text-sm font-medium text-violet-600 dark:text-violet-400` |
| `border border-zinc-200 bg-white py-1 shadow-lg` (mention dropdown, line 211) | `border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-1 shadow-lg` |
| `text-sm text-zinc-700 hover:bg-zinc-100` (mention item, line 216) | `text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700` |
| `text-xs text-zinc-400` (add to thread hint, line 233) | `text-xs text-zinc-400 dark:text-zinc-500` |
| `border border-zinc-200 object-cover` (pending image border, line 247) | `border border-zinc-200 dark:border-zinc-700 object-cover` |
| `text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600` (attach button, line 275) | `text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300` |
| `border bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400` (textarea, line 291) | `border bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400` |
| `border-zinc-200 focus:border-violet-500 focus:ring-1 focus:ring-violet-500` (textarea non-listening, line 294) | `border-zinc-200 dark:border-zinc-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500` |
| `bg-zinc-100 text-zinc-400 hover:border-violet-500 hover:text-violet-500 border border-transparent` (mic button idle, line 317) | `bg-zinc-100 dark:bg-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-violet-500 border border-transparent` |
| `bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800` (send button, line 341) | `bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200` |

- [ ] **Step 2: Commit**

```bash
git add src/components/MessageInput.tsx
git commit -m "feat: add dark mode variants to MessageInput"
```

### Task 9: Add dark variants to ThreadList.tsx

**Files:**
- Modify: `src/components/ThreadList.tsx`

- [ ] **Step 1: Update color classes**

Apply these replacements:

| Find | Replace |
|------|---------|
| `border border-zinc-200 bg-white py-1 shadow-lg` (context menu, line 45) | `border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-1 shadow-lg` |
| `text-sm text-zinc-700 hover:bg-zinc-100` (context menu item, line 55) | `text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700` |
| `hover:bg-zinc-100` (thread item hover, line 98) | `hover:bg-zinc-100 dark:hover:bg-zinc-800` |
| `bg-zinc-100` (thread item selected, line 99) | `bg-zinc-100 dark:bg-zinc-800` |
| `bg-zinc-100` (single agent avatar, line 104) | `bg-zinc-100 dark:bg-zinc-800` |
| `bg-white` (multi-agent avatar, line 131) | `bg-white dark:bg-zinc-800` |
| `truncate text-sm font-medium text-zinc-900` (thread title, line 154) | `truncate text-sm font-medium text-zinc-900 dark:text-zinc-100` |
| `text-[11px] text-zinc-500` (date, line 167) | `text-[11px] text-zinc-500 dark:text-zinc-400` |
| `truncate text-xs text-zinc-500` (agent names and preview, lines 172 and 176) | `truncate text-xs text-zinc-500 dark:text-zinc-400` |
| `bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500` (message count badge, line 181) | `bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400` |
| `text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600` (overflow menu, line 192) | `text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300` |
| `border-r border-zinc-200` (sidebar border, line 246) | `border-r border-zinc-200 dark:border-zinc-700` |
| `border-b border-zinc-200` (header border, line 247) | `border-b border-zinc-200 dark:border-zinc-700` |
| `text-lg font-semibold text-zinc-900` (Entourage title, line 250) | `text-lg font-semibold text-zinc-900 dark:text-zinc-100` |
| `bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800` (New button, line 254) | `bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200` |
| `text-sm text-zinc-400` (empty state, line 261) | `text-sm text-zinc-400 dark:text-zinc-500` |
| `border-t border-zinc-100` (archived separator, line 279) | `border-t border-zinc-100 dark:border-zinc-700` |
| `text-xs font-medium text-zinc-500 hover:bg-zinc-50` (archived button, line 282) | `text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800` |
| `border-t border-zinc-200` (footer border, line 307) | `border-t border-zinc-200 dark:border-zinc-700` |
| `text-sm text-zinc-600 hover:bg-zinc-100` (settings button, line 310) | `text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800` |

- [ ] **Step 2: Commit**

```bash
git add src/components/ThreadList.tsx
git commit -m "feat: add dark mode variants to ThreadList"
```

### Task 10: Add dark variants to ThreadDetail.tsx

**Files:**
- Modify: `src/components/ThreadDetail.tsx`

- [ ] **Step 1: Update color classes**

Apply these replacements:

| Find | Replace |
|------|---------|
| `text-zinc-400` (empty state, line 67) | `text-zinc-400 dark:text-zinc-500` |
| `border-b border-zinc-200` (header border, line 90) | `border-b border-zinc-200 dark:border-zinc-700` |
| `text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700` (back button, line 95) | `text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300` |
| `border border-zinc-300 bg-white px-1.5 py-0.5 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-500` (title input, line 119) | `border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-1.5 py-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-500` |
| `text-sm font-medium text-zinc-900` (title heading, line 124) | `text-sm font-medium text-zinc-900 dark:text-zinc-100` |
| `hover:text-zinc-600` (title hover, line 124) | `hover:text-zinc-600 dark:hover:text-zinc-400` |
| `text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600` (mobile edit button, line 141) | `text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300` |
| `bg-zinc-100 px-2.5 py-1 text-xs` (agent pill, line 153) | `bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs` |
| `bg-zinc-100` (agent pill icon bg, line 156) | `bg-zinc-100 dark:bg-zinc-800` |
| `text-zinc-700` (agent pill name, line 161) | `text-zinc-700 dark:text-zinc-300` |
| `text-zinc-500` (agent pill model, line 162) | `text-zinc-500 dark:text-zinc-400` |

- [ ] **Step 2: Commit**

```bash
git add src/components/ThreadDetail.tsx
git commit -m "feat: add dark mode variants to ThreadDetail"
```

### Task 11: WorkspaceBar.tsx and AgentStatusBadge.tsx

**Files:**
- Modify: `src/components/WorkspaceBar.tsx` (no changes needed)
- Modify: `src/components/AgentStatusBadge.tsx`
- Note: `src/components/ModelIcon.tsx` — no changes needed (renders SVG images and lucide icons; verify SVG visibility in dark mode during visual testing)

The WorkspaceBar is already dark-themed (`bg-zinc-900`, `text-white`, `bg-zinc-800`, `bg-zinc-700`) including its context menu. No changes needed.

- [ ] **Step 1: Update AgentStatusBadge.tsx**

In `src/components/AgentStatusBadge.tsx`, update the idle color:

| Find | Replace |
|------|---------|
| `bg-zinc-300` (idle status, line 7) | `bg-zinc-300 dark:bg-zinc-600` |

- [ ] **Step 2: Commit**

```bash
git add src/components/AgentStatusBadge.tsx
git commit -m "feat: add dark mode variant to AgentStatusBadge"
```

### Task 12: Add dark variants to remaining dialog components

**Files:**
- Modify: `src/components/AddWorkspaceDialog.tsx`
- Modify: `src/components/NewThreadDialog.tsx`
- Modify: `src/components/IconPicker.tsx`

- [ ] **Step 1: Update AddWorkspaceDialog.tsx**

Apply these replacements:

| Find | Replace |
|------|---------|
| `bg-white rounded-xl shadow-2xl` (form container — appears twice on line 65) | `bg-white dark:bg-zinc-800 rounded-xl shadow-2xl` |
| `text-lg font-semibold text-zinc-900` (title, line 67) | `text-lg font-semibold text-zinc-900 dark:text-zinc-100` |
| `text-zinc-400 hover:text-zinc-600` (close button, line 69) | `text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300` |
| `text-sm font-medium text-zinc-700 mb-1` (labels, lines 77, 91, 104) | `text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1` |
| `text-zinc-400` (optional hint, line 92) | `text-zinc-400 dark:text-zinc-500` |
| `border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent` (inputs, lines 85 and 99) | `border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent` |
| `ring-2 ring-offset-2 ring-zinc-900 scale-110` (selected color, line 114) | `ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 dark:ring-offset-zinc-800 scale-110` |
| `text-sm text-red-600` (error, line 123) | `text-sm text-red-600 dark:text-red-400` |
| `text-sm text-zinc-600 hover:text-zinc-900` (cancel button, line 131) | `text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200` |
| `text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-800` (submit button, line 139) | `text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200` |
| `bg-zinc-50` (inline container bg, line 150) | `bg-zinc-50 dark:bg-zinc-900` |

- [ ] **Step 2: Update NewThreadDialog.tsx**

Apply these replacements:

| Find | Replace |
|------|---------|
| `bg-white p-4 md:p-6 shadow-xl` (dialog, line 55) | `bg-white dark:bg-zinc-800 p-4 md:p-6 shadow-xl` |
| `text-lg font-semibold text-zinc-900` (title, line 56) | `text-lg font-semibold text-zinc-900 dark:text-zinc-100` |
| `text-sm font-medium text-zinc-700` (labels, lines 59 and 77) | `text-sm font-medium text-zinc-700 dark:text-zinc-300` |
| `border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500` (input, line 65) | `border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500` |
| `bg-zinc-900 text-white` (selected agent, line 87) | `bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900` |
| `bg-zinc-100 text-zinc-600 hover:bg-zinc-200` (unselected agent, line 88) | `bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600` |
| `bg-white` (agent icon bg, line 92) | `bg-white dark:bg-zinc-800` |
| `text-sm text-zinc-600 hover:bg-zinc-100` (cancel button, line 110) | `text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700` |
| `bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800` (create button, line 117) | `bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200` |

- [ ] **Step 3: Update IconPicker.tsx**

Apply these replacements:

| Find | Replace |
|------|---------|
| `bg-zinc-900 text-white` (active tab, lines 57 and 65) | `bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900` |
| `bg-zinc-100 text-zinc-600 hover:bg-zinc-200` (inactive tab, lines 57 and 65) | `bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600` |
| `border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500` (search input, line 80) | `border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500` |
| `border border-zinc-200 p-2` (icon grid container, line 82) | `border border-zinc-200 dark:border-zinc-600 p-2` |
| `bg-violet-100 text-violet-700 ring-1 ring-violet-500` (selected icon, line 93) | `bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 ring-1 ring-violet-500` |
| `text-zinc-600 hover:bg-zinc-100` (unselected icon, line 95) | `text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700` |
| `text-xs text-zinc-400` (no icons found, line 103) | `text-xs text-zinc-400 dark:text-zinc-500` |
| `border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500` (emoji input, line 119) | `border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500` |

- [ ] **Step 4: Commit**

```bash
git add src/components/AddWorkspaceDialog.tsx src/components/NewThreadDialog.tsx src/components/IconPicker.tsx
git commit -m "feat: add dark mode variants to dialogs and IconPicker"
```

## Chunk 4: Final Verification

### Task 13: Full build and lint check

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Fix any issues found, commit fixes**

If lint or build fails, fix the issues and commit:
```bash
git add -u
git commit -m "fix: resolve lint/build issues in dark mode implementation"
```

### Task 14: Visual smoke test

- [ ] **Step 1: Start dev server and test**

Run: `npm run dev`

Verify the following in the browser:
1. App loads in light mode (or dark if OS is dark)
2. Open Settings → Theme toggle is visible above Agent Profiles
3. Click toggle → entire app switches theme
4. Refresh page → theme preference persists
5. Check these views in dark mode:
   - Thread list sidebar
   - Thread detail view
   - Message bubbles (user and agent)
   - Code blocks in messages
   - New Thread dialog
   - Settings dialog (agent form)
   - Add Workspace dialog
   - Mention autocomplete dropdown
   - Context menus
   - Agent model icons (SVGs) — verify they're visible against dark backgrounds
   - WorkspaceBar (should remain dark-themed regardless of mode)
