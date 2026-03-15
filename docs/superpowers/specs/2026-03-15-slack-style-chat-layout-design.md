# Slack-Style Chat Layout

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Frontend UI only — no data model changes

## Summary

Restyle Nexus's chat message display from a bubble-based chat interface to a Slack-style flat message layout. This is a pure rendering change — messages are grouped at display time, the data layer is untouched, and the existing `MessageBubble.tsx` is preserved for rollback.

## Motivation

Slack has rethought chat UI for work contexts. Its flat, information-dense layout is better suited for AI agent interactions where messages contain code, long-form explanations, and structured output. The current bubble style wastes horizontal space and doesn't visually distinguish content types well.

## Scope

### In scope
- Full Slack-style flat message layout (left-aligned, full-width, no bubbles)
- Message grouping (consecutive same-sender messages under one avatar/header)
- Rich message block styling (code blocks with language labels + copy buttons, error blocks, improved prose rendering)
- Streaming and error state reskinning

### Out of scope
- Inline threads / reply threads (future roadmap)
- Channel / group organization (future roadmap)
- Data model changes — all grouping is pure rendering logic
- Interactive blocks (apply-to-file, diff views)

## Design

### Component Architecture

```
ThreadDetail (modified — swap message rendering)
  └── MessageList (new)
        └── MessageGroup (new)
              └── SlackMessage (new)
```

**Files changed:**
- **New:** `src/components/MessageList.tsx`
- **New:** `src/components/MessageGroup.tsx`
- **New:** `src/components/SlackMessage.tsx`
- **Modified:** `src/components/ThreadDetail.tsx` — replace current message mapping with `<MessageList />`
- **Untouched:** `MessageBubble.tsx` (kept for rollback), `MessageInput.tsx`, all data/API layers

### Message Layout

Every message is full-width, left-aligned, with no bubble or max-width constraint.

**Group header (first message in a group):**
```
[36px square avatar] [12px gap] [Bold name]  [muted timestamp]
                                [message content — full width]
```

**Subsequent messages in same group:**
```
[36px spacer]        [12px gap] [message content — full width]
```

- Timestamps on subsequent messages appear on hover (right-aligned)
- Thin bottom border between groups, not between messages within a group
- Light hover highlight on individual messages (`bg-zinc-50`)

### Grouping Rules

Implemented in `MessageList.tsx` as a pure function over the messages array:

1. Walk messages in order
2. Start a new group when:
   - Sender changes (different `agentId`, or switch between user/agent role)
   - Time gap between consecutive messages exceeds **5 minutes** (defined as a `GROUP_GAP_MS` constant for easy tuning)
3. User messages all share a single sender identity for grouping — consecutive user messages group together (there is only one human user, no `agentId` needed)
4. User messages use the same layout — square avatar with user initial, name, timestamp

### Rich Message Blocks

Enhanced `react-markdown` component overrides in `SlackMessage.tsx`:

**Code blocks (`pre` + `code`):**
- Dark background (`bg-zinc-900`), light text, rounded corners (`rounded-lg`)
- Language label top-left in a muted pill (parsed from markdown fence info)
- Copy button top-right, visible on hover; icon changes to checkmark briefly on copy (no toast)
- No new syntax highlighting dependency in this phase — use dark background with monospace text only. Syntax highlighting (e.g., `rehype-highlight`) can be added as a follow-up

**Inline code:**
- `bg-zinc-100`, slight padding, `font-mono`, `text-sm`

**Error messages** (`status === "error"`):
- Left red border (`border-l-4 border-red-500`)
- Light red background tint (`bg-red-50`)
- Error icon inline with status text

**Prose:**
- `text-sm`, `leading-relaxed`
- Blockquotes: left border, muted background
- Tables: bordered, striped rows
- Lists: proper indentation and markers

### Streaming Indicators

- Pulsing dot next to the agent name in the group header during streaming
- Content streams in progressively within the flat layout (same mechanism as current)
- No separate streaming bubble

### Image Attachments

User messages may include images (`images?: MessageImage[]`). In the new layout:
- Images render below the message text content, same as current behavior
- Displayed as thumbnails in a horizontal row, clickable to expand
- Carried over from `MessageBubble.tsx`'s image rendering logic (lines 84-101)

### @Mention Highlighting

User messages may contain `@agentName` mentions. The existing `renderContent()` logic from `MessageBubble.tsx` (which parses and highlights mentions in violet) must be preserved in `SlackMessage.tsx` for user messages.

### Reconnecting State

When a streaming message has no content yet, display "Reconnecting..." text (carried over from current behavior in `MessageBubble.tsx`).

### Avatar Styling

- **Square with rounded corners** (`rounded-lg`), 36x36px
- Agent avatars: solid background in agent's configured color, white initial or icon
- User avatar: `bg-zinc-900`, white initial — initial is the first letter of the user's name (hardcoded for now, can be made configurable later)

## Migration

`ThreadDetail.tsx` is the only modified file. The change is a swap:

**Before:** maps `messages` array directly, renders `<MessageBubble />` per message
**After:** passes `messages` and `agents` to `<MessageList />`, which handles grouping and renders `<MessageGroup />` → `<SlackMessage />`

`MessageBubble.tsx` is preserved. Rolling back is a one-line change in `ThreadDetail.tsx`.

## Future Considerations

These are explicitly deferred and not part of this spec:

- **Channels / group organization** — could build on this layout
- **Inline thread replies** — would add a reply affordance per message and a side panel
- **Interactive blocks** — code apply-to-file, diff views, tool-use sections
- **Reactions / annotations** — emoji reactions, bookmarks, pins
