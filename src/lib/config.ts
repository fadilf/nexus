import path from "path";
import { Agent } from "./types";

export const NEXUS_DIR = ".nexus";
export const THREADS_DIR = "threads";
export const UPLOADS_DIR = "uploads";

export function getUploadsDir(): string {
  return path.join(process.cwd(), NEXUS_DIR, UPLOADS_DIR);
}

export const DEFAULT_AGENT_IDS = ["claude", "gemini"];

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "claude",
    name: "Claude",
    model: "claude",
    avatarColor: "#d97706",
    isDefault: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    model: "gemini",
    avatarColor: "#3b82f6",
    isDefault: true,
  },
];

export function getCliCommand(model: string, prompt: string, sessionId: string, isResume: boolean, personality?: string, imagePaths?: string[]): { cmd: string; args: string[] } {
  // Prepend image file paths to the prompt so the CLI can pick them up
  let fullPrompt = prompt;
  if (imagePaths && imagePaths.length > 0) {
    const imageRefs = imagePaths.map((p) => `[Image: ${p}]`).join("\n");
    fullPrompt = `${imageRefs}\n\n${prompt}`;
  }

  if (model === "claude") {
    const args = ["-p", fullPrompt, "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"];
    if (imagePaths && imagePaths.length > 0) {
      for (const p of imagePaths) {
        args.push("--file", p);
      }
    }
    if (isResume) {
      args.push("--resume", sessionId);
    } else {
      args.push("--session-id", sessionId);
    }
    if (personality) {
      args.push("--append-system-prompt", personality);
    }
    return { cmd: "claude", args };
  }

  // Gemini: no --system-instruction flag, prepend to prompt
  let effectivePrompt = fullPrompt;
  if (personality) {
    effectivePrompt = `[System Instructions]\n${personality}\n[End System Instructions]\n\n${fullPrompt}`;
  }

  return {
    cmd: "gemini",
    args: ["-p", effectivePrompt, "--output-format", "stream-json", "--sandbox=none"],
  };
}
