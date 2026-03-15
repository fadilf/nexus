# Slack-Style Chat Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bubble-based chat message display with a Slack-style flat message layout featuring message grouping and rich code block styling.

**Architecture:** Three new components (`MessageList`, `MessageGroup`, `SlackMessage`) replace the message rendering in `ThreadDetail`. The existing `MessageBubble` is preserved for rollback. No data model or API changes — all grouping is pure rendering logic.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, react-markdown, remark-gfm, remark-breaks, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-15-slack-style-chat-layout-design.md`

---

## Chunk 1: SlackMessage Component

### Task 1: Create SlackMessage with basic prose rendering

**Files:**
- Create: `src/components/SlackMessage.tsx`

This component renders a single message's content. It handles both user messages (with @mention highlighting) and agent messages (with markdown rendering). It does NOT handle avatars, names, or timestamps — that's `MessageGroup`'s job.

- [ ] **Step 1: Create `SlackMessage.tsx` with the complete component**

Create the file with all imports, the `CodeBlock` helper, `renderMentions` helper, and the main component in one step:

```tsx
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Message } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useWsParam } from "@/contexts/WorkspaceContext";

function renderMentions(content: string) {
  const parts = content.split(/(@\w+)/g);
  if (parts.length === 1) return content;
  return parts.map((part, i) =>
    /^@\w+/.test(part) ? (
      <span key={i} className="font-medium text-violet-600">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group/code relative my-2 rounded-lg bg-zinc-900 text-zinc-100">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-zinc-400">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 opacity-0 transition-opacity group-hover/code:opacity-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 pb-3 text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function SlackMessage({
  message,
  isUser,
}: {
  message: Message;
  isUser: boolean;
}) {
  const wsParam = useWsParam();
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";

  return (
    <div className="group relative py-0.5 px-1 -mx-1 rounded hover:bg-zinc-50">
      {/* Hover timestamp */}
      <div className="absolute right-2 top-1 hidden text-[11px] text-zinc-400 group-hover:block">
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      {/* Image attachments for user messages */}
      {isUser && message.images && message.images.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {message.images.map((img) => (
            <a
              key={img.id}
              href={`/api/uploads/${img.filename}${wsParam}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={`/api/uploads/${img.filename}${wsParam}`}
                alt={img.filename}
                className="max-h-48 max-w-64 rounded-lg border border-zinc-200 object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {/* Message content */}
      {isError ? (
        <div className="flex items-start gap-2 rounded-md border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-900">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{message.content || "An error occurred"}</span>
        </div>
      ) : isUser ? (
        <div className="text-sm leading-relaxed text-zinc-900 whitespace-pre-wrap">
          {renderMentions(message.content || "")}
        </div>
      ) : (
        <div className="slack-markdown text-sm leading-relaxed text-zinc-900">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-base font-bold mt-4 mb-1.5 first:mt-0">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-sm font-bold mt-4 mb-1.5 first:mt-0">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h3>
              ),
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => (
                <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>
              ),
              li: ({ children }) => <li>{children}</li>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 underline hover:text-violet-800"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-zinc-300 bg-zinc-50 pl-3 py-1 my-2 text-zinc-600 italic">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-2">
                  <table className="min-w-full text-xs border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-zinc-100">{children}</thead>,
              th: ({ children }) => (
                <th className="border border-zinc-200 px-2 py-1 font-semibold text-left">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border border-zinc-200 px-2 py-1">{children}</td>
              ),
              tr: ({ children, ...props }) => {
                // @ts-expect-error -- node not in types but passed by react-markdown
                const isEven = props.node?.position?.start?.line % 2 === 0;
                return <tr className={isEven ? "bg-zinc-50" : ""}>{children}</tr>;
              },
              hr: () => <hr className="my-3 border-zinc-200" />,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              pre: ({ children }) => <>{children}</>,
              code: ({ className, children }) => {
                const match = /language-(\w+)/.exec(className || "");
                const isBlock = !!className?.includes("language-") || (typeof children === "string" && children.includes("\n"));

                if (!isBlock) {
                  return (
                    <code className="bg-zinc-100 text-zinc-800 rounded px-1.5 py-0.5 text-xs font-mono">
                      {children}
                    </code>
                  );
                }

                const language = match?.[1] || "";
                const codeString = String(children).replace(/\n$/, "");

                return <CodeBlock language={language} code={codeString} />;
              },
            }}
          >
            {message.content || (isStreaming ? "" : "")}
          </ReactMarkdown>
        </div>
      )}

      {/* Streaming states */}
      {isStreaming && !message.content && (
        <span className="text-xs text-zinc-400 italic">Reconnecting...</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `SlackMessage.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/SlackMessage.tsx
git commit -m "feat: add SlackMessage component with rich markdown rendering"
```

---

## Chunk 2: MessageGroup and MessageList Components

### Task 2: Create MessageGroup component

**Files:**
- Create: `src/components/MessageGroup.tsx`

This component renders a group header (avatar + name + timestamp) and its child messages. It receives pre-grouped messages and agent info.

- [ ] **Step 1: Create `MessageGroup.tsx`**

```tsx
"use client";

import { Message, Agent } from "@/lib/types";
import ModelIcon from "./ModelIcon";
import SlackMessage from "./SlackMessage";

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type MessageGroupData = {
  senderId: string; // agentId or "user"
  messages: Message[];
};

export default function MessageGroup({
  group,
  agent,
  isUser,
  isStreaming,
}: {
  group: MessageGroupData;
  agent?: Agent;
  isUser: boolean;
  isStreaming: boolean;
}) {
  const firstMessage = group.messages[0];

  return (
    <div className="border-b border-zinc-100 py-2 last:border-b-0">
      {/* Group header with avatar */}
      <div className="flex gap-3 px-4">
        {/* Avatar */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={
            isUser
              ? { backgroundColor: "#18181b" }
              : { backgroundColor: agent?.avatarColor || "#71717a" }
          }
        >
          {isUser ? (
            <span className="text-xs font-semibold text-white">F</span>
          ) : agent ? (
            <ModelIcon
              model={agent.model}
              icon={agent.icon}
              className="h-4 w-4 text-white"
            />
          ) : (
            <span className="text-xs font-semibold text-white">?</span>
          )}
        </div>

        {/* Name + timestamp + first message */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-zinc-900">
              {isUser ? "Fadil" : agent?.name || "Unknown"}
            </span>
            {isStreaming && !isUser && (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            )}
            <span className="text-[11px] text-zinc-400">
              {formatTime(firstMessage.timestamp)}
            </span>
          </div>
          <SlackMessage message={firstMessage} isUser={isUser} />
        </div>
      </div>

      {/* Subsequent messages in the group — indented past avatar */}
      {group.messages.slice(1).map((message) => (
        <div key={message.id} className="flex gap-3 px-4">
          {/* Spacer matching avatar width */}
          <div className="w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <SlackMessage message={message} isUser={isUser} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `MessageGroup.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/MessageGroup.tsx
git commit -m "feat: add MessageGroup component with avatar and header"
```

### Task 3: Create MessageList component with grouping logic

**Files:**
- Create: `src/components/MessageList.tsx`

This component takes a flat array of messages and agents, groups them, and renders `MessageGroup` components.

- [ ] **Step 1: Create `MessageList.tsx`**

```tsx
"use client";

import { Message, Agent } from "@/lib/types";
import MessageGroup, { MessageGroupData } from "./MessageGroup";

const GROUP_GAP_MS = 5 * 60 * 1000; // 5 minutes

export function groupMessages(messages: Message[]): MessageGroupData[] {
  const groups: MessageGroupData[] = [];

  for (const message of messages) {
    const senderId = message.role === "user" ? "user" : (message.agentId || "unknown");
    const lastGroup = groups[groups.length - 1];

    const timeDiff = lastGroup
      ? new Date(message.timestamp).getTime() -
        new Date(lastGroup.messages[lastGroup.messages.length - 1].timestamp).getTime()
      : Infinity;

    if (lastGroup && lastGroup.senderId === senderId && timeDiff < GROUP_GAP_MS) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ senderId, messages: [message] });
    }
  }

  return groups;
}

export default function MessageList({
  messages,
  agents,
}: {
  messages: Message[];
  agents: Agent[];
}) {
  const groups = groupMessages(messages);

  return (
    <>
      {groups.map((group, i) => {
        const isUser = group.senderId === "user";
        const agent = isUser
          ? undefined
          : agents.find((a) => a.id === group.senderId);
        const isStreaming = !isUser && group.messages.some(
          (m) => m.status === "streaming"
        );

        return (
          <MessageGroup
            key={`${group.senderId}-${group.messages[0].id}`}
            group={group}
            agent={agent}
            isUser={isUser}
            isStreaming={isStreaming}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `MessageList.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/MessageList.tsx
git commit -m "feat: add MessageList component with grouping logic"
```

---

## Chunk 3: Integration and Wiring

### Task 4: Wire MessageList into ThreadDetail

**Files:**
- Modify: `src/components/ThreadDetail.tsx`

Replace the current `MessageBubble` rendering loop with `MessageList`. The `MessageBubble` import is removed from this file but the file itself is preserved.

- [ ] **Step 1: Update imports and remove `resolveAgent` in `ThreadDetail.tsx`**

Replace the `MessageBubble` import:
```tsx
import MessageBubble from "./MessageBubble";
```

With:
```tsx
import MessageList from "./MessageList";
```

Delete the `resolveAgent` helper function (lines 10-13) — no longer needed since `MessageList` handles agent resolution internally.

Note: Do NOT remove the `ModelIcon` import — it is still used in the agent pills header section (line 159).

- [ ] **Step 2: Replace the message rendering block**

Replace the message rendering section (the `<div ref={scrollRef} ...>` contents, lines 167-182):

```tsx
{allMessages.map((message) => {
  const agent = resolveAgent(message, thread.agents);
  return (
    <MessageBubble
      key={message.id}
      message={message}
      isOwn={message.role === "user"}
      agentName={agent?.name}
      avatarColor={agent?.avatarColor}
      model={agent?.model}
      icon={agent?.icon}
      isMobile={isMobile}
    />
  );
})}
```

With:

```tsx
<MessageList
  messages={allMessages}
  agents={thread.agents}
/>
```

- [ ] **Step 3: Update the scroll container styling**

The current scroll container has `gap-4` for spacing between bubble messages. With the new layout, groups handle their own spacing via borders and padding. Change:

```tsx
<div ref={scrollRef} className={`flex flex-1 flex-col gap-4 overflow-y-auto ${isMobile ? "px-4" : "px-6"} py-5`}>
```

To:

```tsx
<div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto py-2">
```

The horizontal padding is handled inside `MessageGroup` components. Vertical padding (`py-2`) is kept on the scroll container to prevent messages from butting against the header and input area.

- [ ] **Step 4: Clean up unused imports**

Check which type imports are now unused after removing `resolveAgent`. The `Agent` type may no longer be directly referenced (it's inferred via `ThreadWithMessages`). Remove only what the compiler flags as unused. Keep `ModelIcon`, `ChevronLeft`, `Pencil` — all still used in this file.

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 6: Run dev server and manually verify**

Run: `npm run dev`

Open `http://localhost:3000` and verify:
- Messages display in flat Slack-style layout (no bubbles)
- Consecutive messages from same agent are grouped under one avatar
- User messages show with dark avatar and name "Fadil"
- Code blocks have dark background with language label and copy button
- Error messages show with red left border
- Streaming messages show pulsing dot next to agent name
- Image attachments on user messages still display
- @mentions in user messages are highlighted in violet
- Hover on any message shows timestamp
- Scroll behavior still works (auto-scroll to bottom on new messages)

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/components/ThreadDetail.tsx
git commit -m "feat: wire MessageList into ThreadDetail, replacing MessageBubble rendering"
```

### Task 5: Build verification

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Commit (if any fixes were needed)**

Only if build revealed issues that required fixes:
```bash
git add -u
git commit -m "fix: resolve build issues in slack-style layout"
```
