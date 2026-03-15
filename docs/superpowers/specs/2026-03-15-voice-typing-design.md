# Voice Typing Mode — Design Spec

## Overview

Add speech-to-text voice typing to the message input. Users click a mic icon inside the textarea to start transcription via the Web Speech API. Transcribed text appears in real-time (with interim results) and is editable before sending. Browser-only — no backend changes.

## Approach

Use the browser's built-in `SpeechRecognition` (Web Speech API). Zero dependencies, no API keys, supports interim results natively. Only renders the mic button in supported browsers (Chrome, Edge, Safari).

## New Hook: `useVoiceInput`

**File:** `src/hooks/useVoiceInput.ts`

A custom React hook wrapping the Web Speech API.

### State

- `isListening: boolean` — whether recognition is active
- `interimText: string` — current unfinalized transcription
- `isSupported: boolean` — whether the browser supports `SpeechRecognition`

### API

- `startListening(): void` — requests mic permission, starts recognition
- `stopListening(): void` — stops recognition, finalizes pending text
- `toggle(): void` — convenience start/stop toggle

### Constructor Options

- `onTranscript: (text: string) => void` — callback invoked with finalized transcript text to append to the input

### Behavior

- Uses `webkitSpeechRecognition` with `interimResults: true` and `continuous: true`
- `onresult`: final transcripts are passed to `onTranscript` callback. Interim text is stored in `interimText` state for display.
- `onerror`: stops listening, clears interim text. No toast or modal — silent recovery.
- `onend`: if `isListening` is still true (unexpected stop, e.g., silence timeout), auto-restart recognition. Otherwise finalize.
- Language: defaults to `navigator.language`

## UI Changes: `MessageInput.tsx`

### Idle State

- Small mic icon (`Mic` from lucide-react) positioned absolutely inside the textarea, right edge, vertically centered
- Only rendered if `isSupported` is true
- Styling: zinc background circle, violet border on hover
- Textarea gets right padding to avoid text overlapping the mic icon

### Active (Recording) State

- Mic icon swaps to stop-square icon (`Square` from lucide-react)
- Icon background turns red (`bg-red-500`), pulsing animation via CSS
- Entire input container gets violet border (`border-violet-500`) and violet glow (`box-shadow: 0 0 12px rgba(124, 58, 237, 0.3)`)
- Interim text is appended to the textarea display value in a visually distinct way (dimmer/lighter color)
- Textarea remains editable — user can type and talk simultaneously

### Stopping

- Triggered by: clicking the stop icon, or pressing `Escape`
- Interim text finalizes via last `onresult` with `isFinal`
- Glow and recording indicators disappear
- Textarea retains all transcribed text, cursor at end

## Data Flow

```
User clicks mic → toggle() → SpeechRecognition.start()
  → onresult (interim) → setInterimText() → textarea shows content + interim
  → onresult (final)   → onTranscript(text) → append to content state, clear interim
User clicks stop → stopListening() → SpeechRecognition.stop()
  → onend → clear interim, set isListening=false
```

## Interim Text Display

The textarea's displayed value is `content + interimText`. The `content` state holds only finalized text. When `onTranscript` fires with final text, it appends to `content` and clears `interimText`. This means:

- The user always sees the full text (finalized + in-progress)
- Only finalized text is sent when the user hits Enter
- The textarea `onChange` handler only updates `content` (manual typing), not interim text

## File Changes

| File | Change |
|------|--------|
| `src/hooks/useVoiceInput.ts` | New — hook wrapping Web Speech API |
| `src/components/MessageInput.tsx` | Add mic button inside textarea, wire up hook, add recording state styles |

## Scope Exclusions

- No language picker (uses `navigator.language`)
- No audio recording or voice message attachments
- No backend changes or API routes
- No settings or preferences UI for voice
- No fallback for unsupported browsers — mic button simply doesn't render
- No keyboard shortcut to toggle voice (just the button + Escape to stop)
