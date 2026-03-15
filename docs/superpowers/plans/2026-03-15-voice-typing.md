# Voice Typing Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add speech-to-text voice typing to the message input using the Web Speech API.

**Architecture:** A `useVoiceInput` hook wraps the browser's `SpeechRecognition` API, exposing listening state, interim text, and toggle controls. The existing `MessageInput` component gets a mic button inside the textarea and an interim text label below it. No backend changes.

**Tech Stack:** Web Speech API (`webkitSpeechRecognition`), React 19, TypeScript, Tailwind CSS v4, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-15-voice-typing-design.md`

**Note:** No test framework is configured in this project. Verification is done via `npm run build` and `npm run lint`, plus manual browser testing.

---

## Chunk 1: useVoiceInput Hook

### Task 1: Create the useVoiceInput hook

**Files:**
- Create: `src/hooks/useVoiceInput.ts`

- [ ] **Step 1: Create the hook file with type declarations and feature detection**

```typescript
// src/hooks/useVoiceInput.ts
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// Local type declarations for the Web Speech API (not always in TS lib)
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as Record<string, unknown>).SpeechRecognition ??
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  ) as (new () => SpeechRecognitionInstance) | null ?? null;
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [isSupported] = useState(() => getSpeechRecognition() !== null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        isListeningRef.current = false;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setInterimText("");
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    // Clean up any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          onTranscriptRef.current(result[0].transcript);
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        setPermissionDenied(true);
        setTimeout(() => setPermissionDenied(false), 2000);
      }
      isListeningRef.current = false;
      setIsListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        // Unexpected stop (e.g., silence timeout) — auto-restart
        try {
          recognition.start();
        } catch {
          isListeningRef.current = false;
          setIsListening(false);
          setInterimText("");
        }
      } else {
        setInterimText("");
      }
    };

    recognitionRef.current = recognition;
    isListeningRef.current = true;
    setIsListening(true);
    setPermissionDenied(false);

    try {
      recognition.start();
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  return {
    isListening,
    interimText,
    isSupported,
    permissionDenied,
    startListening,
    stopListening,
    toggle,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: Build succeeds (hook is not imported anywhere yet, but TypeScript should still compile it)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useVoiceInput.ts
git commit -m "feat: add useVoiceInput hook wrapping Web Speech API"
```

---

## Chunk 2: MessageInput UI Integration

### Task 2: Add mic button and wire up voice input

**Files:**
- Modify: `src/components/MessageInput.tsx`

- [ ] **Step 1: Add imports**

At the top of `MessageInput.tsx`, add the new imports:

```typescript
// Add to existing import from lucide-react (line 4):
import { Paperclip, X, Mic, Square } from "lucide-react";

// Add new import after line 6:
import { useVoiceInput } from "@/hooks/useVoiceInput";
```

- [ ] **Step 2: Wire up the hook inside the component**

After `const fileInputRef = useRef<HTMLInputElement>(null);` (line 36), add:

```typescript
  const { isListening, interimText, isSupported, permissionDenied, toggle, stopListening: stopVoice } = useVoiceInput(
    useCallback((text: string) => {
      setContent((prev) => prev + text);
    }, [])
  );
```

- [ ] **Step 3: Update the Escape key handler**

Replace the existing Escape handler in `handleKeyDown` (lines 144-146):

```typescript
// Old:
      if (e.key === "Escape") {
        setShowMentions(false);
      }

// New:
      if (e.key === "Escape") {
        if (isListening) {
          stopVoice();
        } else {
          setShowMentions(false);
        }
      }
```

Update the `handleKeyDown` dependency array to include `isListening` and `stopVoice`:

```typescript
    [handleSend, isListening, stopVoice]
```

- [ ] **Step 4: Wrap textarea in a relative container and add the mic button**

Replace the bare `<textarea>` (lines 270-286) with:

```tsx
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={`Message ${agents.map((a) => a.name).join(", ")}... (@ to mention)`}
            disabled={disabled}
            rows={1}
            className={`w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50 ${
              isListening
                ? "border-violet-500 ring-1 ring-violet-500"
                : "border-zinc-200 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            }`}
            style={{
              maxHeight: "120px",
              paddingRight: isSupported ? "2.5rem" : undefined,
              ...(isListening ? { boxShadow: "0 0 12px rgba(124, 58, 237, 0.3)" } : {}),
            }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          {isSupported && (
            <button
              type="button"
              onClick={toggle}
              disabled={disabled}
              className={`absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                permissionDenied
                  ? "bg-red-500 text-white"
                  : isListening
                    ? "animate-pulse bg-red-500 text-white"
                    : "bg-zinc-100 text-zinc-400 hover:border-violet-500 hover:text-violet-500 border border-transparent"
              } disabled:opacity-50`}
              title={isListening ? "Stop voice input" : "Start voice input"}
            >
              {isListening ? (
                <Square className="h-3 w-3" />
              ) : (
                <Mic className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
```

- [ ] **Step 5: Add interim text label below the input controls**

After the closing `</div>` of the `flex items-end gap-2` container (after the Send/Stop button, after line 304), add:

```tsx
      {isListening && interimText && (
        <div className="mt-1.5 flex items-center gap-1.5 px-1">
          <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
          <span className="truncate text-xs text-zinc-400 italic">
            {interimText}
          </span>
        </div>
      )}
```

- [ ] **Step 6: Verify build and lint pass**

Run: `npm run build && npm run lint`
Expected: Both pass with no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/MessageInput.tsx
git commit -m "feat: add voice typing mic button and interim text display to MessageInput"
```

---

## Chunk 3: Manual Verification

### Task 3: Manual browser testing

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify idle state**

Open `http://localhost:3000` in Chrome/Edge. Check:
- Mic icon visible inside the textarea, bottom-right corner
- Hovering the mic shows violet border
- Mic button does NOT appear in Firefox (if testable)

- [ ] **Step 3: Verify recording state**

Click the mic icon. Check:
- Browser requests microphone permission (grant it)
- Mic icon changes to a red pulsing stop square
- Textarea border turns violet with glow
- Speaking produces interim text below the textarea
- Finalized text appears in the textarea
- Textarea is still editable while recording

- [ ] **Step 4: Verify stopping**

- Click the stop icon → recording stops, glow disappears
- Start recording again → press Escape → recording stops
- Open @mentions dropdown → press Escape → dropdown closes (voice not active)
- Start recording → open @mentions → press Escape → recording stops (not dropdown)

- [ ] **Step 5: Verify edge cases**

- Start recording → switch to a different thread → no console errors (unmount cleanup)
- Deny mic permission → mic icon briefly flashes red
- Send a message while recording → message sends with finalized text only

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address voice typing issues found during manual testing"
```
