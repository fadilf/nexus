# Responsive Mobile Design

## Summary

Make Entourage usable on mobile devices using a screen-swap pattern: on screens below 768px, the app shows either the thread list or the chat view, never both simultaneously. The WorkspaceBar is hidden on mobile.

## Breakpoint

- `md` (768px) is the boundary. Below = mobile layout. At or above = current desktop layout unchanged.

## Mobile Layout Behavior

### Screen Swap (page.tsx)

- Add a `useIsMobile` hook that watches `(max-width: 767px)` via `matchMedia`.
- On mobile, when no thread is selected (`selectedThreadId === null`): show ThreadList full-width.
- On mobile, when a thread is selected: show ThreadDetail full-width.
- WorkspaceBar is not rendered on mobile (conditional JS, not CSS — avoids mounting unused component and running its effects).
- The resizable sidebar handle is not rendered on mobile.

### ThreadDetail Header

- On mobile: prepend a back button (ChevronLeft icon). ThreadDetail receives a new `onBack` prop; page.tsx passes `() => setSelectedThreadId(null)`.
- On desktop: no change (onBack is undefined, back button not rendered).

### ThreadList

- On mobile: renders full-width (`w-full`) instead of the fixed/resizable width.
- Thread context menu (Archive): add a visible "..." overflow button on each thread item for mobile, since right-click context menus don't work on touch devices.

### ThreadDetail Title

- Double-click rename doesn't work reliably on mobile. Add a small edit (pencil) icon button next to the title on mobile as an alternative trigger.

### MessageBubble

- On mobile: `max-w-[85%]` instead of `max-w-[75%]` for better use of narrow screens.

### MessageInput

- On mobile: reduce horizontal padding from `px-6` to `px-4`.
- Mentions popup: use `left-4` instead of `left-6` on mobile to prevent clipping on narrow screens.

### Dialogs (Settings, NewThread, AddWorkspace)

- Add responsive margins: `mx-4` on mobile so dialogs don't touch screen edges.
- Reduce padding from `p-6` to `p-4` on mobile to maximize usable space.
- IconPicker grid: `grid-cols-6 md:grid-cols-8`.

## New Code

### `src/hooks/useIsMobile.ts`

A single hook using `useSyncExternalStore` (React 19 best practice):

```ts
import { useSyncExternalStore } from "react";

export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false // SSR snapshot
  );
}
```

## Files Modified

1. `src/hooks/useIsMobile.ts` — new file (hook)
2. `src/app/page.tsx` — conditional rendering for mobile screen-swap
3. `src/components/ThreadDetail.tsx` — back button on mobile, edit icon for title rename
4. `src/components/ThreadList.tsx` — full-width on mobile, overflow menu for context actions
5. `src/components/MessageBubble.tsx` — wider max-width on mobile
6. `src/components/MessageInput.tsx` — responsive padding and mentions positioning
7. `src/components/SettingsDialog.tsx` — responsive dialog sizing and padding
8. `src/components/NewThreadDialog.tsx` — responsive dialog sizing and padding
9. `src/components/AddWorkspaceDialog.tsx` — responsive dialog sizing and padding
10. `src/components/IconPicker.tsx` — responsive grid columns

## Out of Scope

- Gesture/swipe navigation
- PWA or app-shell features
- Landscape-specific layouts
- Tablet-specific layouts (tablet gets desktop layout)
