# Signal "E" Logo Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing PNG pinwheel logo with a new "Signal E" SVG lettermark in teal, with separate light and dark variants.

**Architecture:** Create two SVG files (light/dark) in `public/`, a `Logo` React component for theme-aware rendering, generate PNG fallbacks for PWA/Safari using a Node script with `sharp`, and update all references (layout metadata, ThreadList, manifest, README).

**Tech Stack:** SVG, React, next-themes, sharp (already available via Next.js)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `public/logo-light.svg` | Light mode SVG logo |
| Create | `public/logo-dark.svg` | Dark mode SVG logo |
| Create | `src/components/Logo.tsx` | Theme-aware logo component |
| Create | `scripts/generate-logo-pngs.mjs` | Generate PNG icons from SVG |
| Modify | `src/components/ThreadList.tsx:206` | Use Logo component |
| Modify | `src/app/layout.tsx:25-28` | Update favicon metadata |
| Modify | `public/manifest.json:8` | Update theme_color |
| Modify | `README.md:2` | Update logo reference |
| Delete | `public/logo.png` | Remove old logo |

---

### Task 1: Create SVG logo files

**Files:**
- Create: `public/logo-light.svg`
- Create: `public/logo-dark.svg`

- [ ] **Step 1: Create the light SVG**

Write `public/logo-light.svg`:

```svg
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="25" y="20" width="50" height="8" rx="4" fill="#0d9488"/>
  <rect x="25" y="34" width="38" height="8" rx="4" fill="#14b8a6"/>
  <rect x="25" y="48" width="46" height="8" rx="4" fill="#0d9488"/>
  <rect x="25" y="62" width="32" height="8" rx="4" fill="#14b8a6"/>
  <rect x="25" y="76" width="50" height="8" rx="4" fill="#0d9488"/>
</svg>
```

- [ ] **Step 2: Create the dark SVG**

Write `public/logo-dark.svg`:

```svg
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="25" y="20" width="50" height="8" rx="4" fill="#2dd4bf"/>
  <rect x="25" y="34" width="38" height="8" rx="4" fill="#5eead4"/>
  <rect x="25" y="48" width="46" height="8" rx="4" fill="#2dd4bf"/>
  <rect x="25" y="62" width="32" height="8" rx="4" fill="#5eead4"/>
  <rect x="25" y="76" width="50" height="8" rx="4" fill="#2dd4bf"/>
</svg>
```

- [ ] **Step 3: Commit**

```bash
git add public/logo-light.svg public/logo-dark.svg
git commit -m "feat: add Signal E logo SVGs (light and dark)"
```

---

### Task 2: Generate PNG fallbacks

**Files:**
- Create: `scripts/generate-logo-pngs.mjs`
- Overwrites: `public/icon-192.png`, `public/icon-512.png`
- Create: `public/favicon.png`

- [ ] **Step 1: Write the PNG generation script**

Write `scripts/generate-logo-pngs.mjs`. This script uses `sharp` (already available as a Next.js dependency) to render the light SVG into PNG icons at 32px, 192px, and 512px. The 192px and 512px versions add padding for maskable icon safe zone (80% inner area).

```js
import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");
const svg = readFileSync(resolve(publicDir, "logo-light.svg"));

// Favicon — 32px, no extra padding needed
await sharp(svg).resize(32, 32).png().toFile(resolve(publicDir, "favicon.png"));

// PWA icons — add padding for maskable safe zone (80% inner)
// Logo occupies center 80% of canvas, 10% padding on each side
for (const size of [192, 512]) {
  const padding = Math.round(size * 0.1);
  const innerSize = size - padding * 2;
  const inner = await sharp(svg).resize(innerSize, innerSize).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: inner, left: padding, top: padding }])
    .png()
    .toFile(resolve(publicDir, `icon-${size}.png`));
}

console.log("Generated: favicon.png, icon-192.png, icon-512.png");
```

- [ ] **Step 2: Run the script**

Run: `node scripts/generate-logo-pngs.mjs`
Expected: `Generated: favicon.png, icon-192.png, icon-512.png`

- [ ] **Step 3: Verify the files exist**

Run: `ls -la public/favicon.png public/icon-192.png public/icon-512.png`
Expected: All three files present with non-zero sizes.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-logo-pngs.mjs public/favicon.png public/icon-192.png public/icon-512.png
git commit -m "feat: add PNG logo fallbacks for PWA and Safari"
```

---

### Task 3: Create Logo component

**Files:**
- Create: `src/components/Logo.tsx`

- [ ] **Step 1: Write the Logo component**

This component renders the Signal E inline SVG and switches colors based on the current theme. It uses `useTheme` from `next-themes` and defaults to light colors on first render to avoid hydration mismatch.

Write `src/components/Logo.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "h-7 w-7" }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const primary = isDark ? "#2dd4bf" : "#0d9488";
  const secondary = isDark ? "#5eead4" : "#14b8a6";

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="25" y="20" width="50" height="8" rx="4" fill={primary} />
      <rect x="25" y="34" width="38" height="8" rx="4" fill={secondary} />
      <rect x="25" y="48" width="46" height="8" rx="4" fill={primary} />
      <rect x="25" y="62" width="32" height="8" rx="4" fill={secondary} />
      <rect x="25" y="76" width="50" height="8" rx="4" fill={primary} />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Logo.tsx
git commit -m "feat: add theme-aware Logo component"
```

---

### Task 4: Update ThreadList header

**Files:**
- Modify: `src/components/ThreadList.tsx:206`

- [ ] **Step 1: Replace img with Logo component**

In `src/components/ThreadList.tsx`, add the import at the top with the other component imports:

```tsx
import Logo from "@/components/Logo";
```

Then replace line 206:

```tsx
          <img src="/logo.png" alt="Entourage" className="h-7 w-7" />
```

with:

```tsx
          <Logo className="h-7 w-7" />
```

- [ ] **Step 2: Verify the dev server shows the new logo**

Run: `npm run dev`
Open the app in the browser. The ThreadList header should show the teal Signal E logo. Toggle dark mode in settings — the logo should switch to the lighter teal variant.

- [ ] **Step 3: Commit**

```bash
git add src/components/ThreadList.tsx
git commit -m "feat: use Logo component in ThreadList header"
```

---

### Task 5: Update favicon metadata

**Files:**
- Modify: `src/app/layout.tsx:25-28`

- [ ] **Step 1: Update the icons in metadata**

In `src/app/layout.tsx`, replace:

```ts
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
```

with:

```ts
  icons: {
    icon: [
      { url: "/logo-light.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/logo-light.svg",
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: update favicon to Signal E SVG with PNG fallback"
```

---

### Task 6: Update manifest and README

**Files:**
- Modify: `public/manifest.json:8`
- Modify: `README.md:2`

- [ ] **Step 1: Update manifest theme_color**

In `public/manifest.json`, change:

```json
  "theme_color": "#7c3aed",
```

to:

```json
  "theme_color": "#0d9488",
```

(The icon file references `icon-192.png` and `icon-512.png` are already correct — Task 2 overwrote those files in place.)

- [ ] **Step 2: Update README logo**

In `README.md`, replace line 2:

```html
  <img src="public/logo.png" alt="Entourage" width="128" />
```

with:

```html
  <img src="public/logo-light.svg" alt="Entourage" width="128" />
```

- [ ] **Step 3: Commit**

```bash
git add public/manifest.json README.md
git commit -m "chore: update manifest theme_color and README logo"
```

---

### Task 7: Remove old logo and verify build

**Files:**
- Delete: `public/logo.png`

- [ ] **Step 1: Search for any remaining references to logo.png**

Run: `grep -r "logo.png" src/ public/ README.md --include="*.tsx" --include="*.ts" --include="*.json" --include="*.md"`
Expected: No matches (all references updated in prior tasks).

- [ ] **Step 2: Remove the old logo**

```bash
rm public/logo.png
```

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Run the linter**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 5: Commit**

```bash
git add -u public/logo.png
git commit -m "chore: remove old pinwheel logo"
```
