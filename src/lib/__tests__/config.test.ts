import { describe, it, expect } from "vitest";
import { getCliCommand } from "../config";

describe("getCliCommand thread injection", () => {
  it("injects thread reference paths into claude prompt", () => {
    const threadPaths = [
      "/workspace/.entourage/threads/abc123.json",
      "/workspace/.entourage/threads/def456.json",
    ];
    const { args } = getCliCommand(
      "claude",
      "hello",
      "session-1",
      false,
      undefined,
      undefined,
      "full",
      threadPaths
    );
    const prompt = args[args.indexOf("-p") + 1];
    expect(prompt).toContain("reference conversation thread");
    expect(prompt).toContain("MUST NOT modify");
    expect(prompt).toContain("/workspace/.entourage/threads/abc123.json");
    expect(prompt).toContain("/workspace/.entourage/threads/def456.json");
    expect(prompt).toContain("User message: hello");
  });

  it("does not inject thread text when no threadPaths provided", () => {
    const { args } = getCliCommand("claude", "hello", "session-1", false);
    const prompt = args[args.indexOf("-p") + 1];
    expect(prompt).not.toContain("reference conversation thread");
    expect(prompt).toBe("hello");
  });

  it("injects thread paths into gemini prompt", () => {
    const threadPaths = ["/workspace/.entourage/threads/abc123.json"];
    const { args } = getCliCommand(
      "gemini",
      "hello",
      "session-1",
      false,
      undefined,
      undefined,
      "full",
      threadPaths
    );
    const prompt = args[args.indexOf("-p") + 1];
    expect(prompt).toContain("reference conversation thread");
    expect(prompt).toContain("abc123.json");
  });

  it("injects thread paths into codex prompt", () => {
    const threadPaths = ["/workspace/.entourage/threads/abc123.json"];
    const { args } = getCliCommand(
      "codex",
      "hello",
      "session-1",
      false,
      undefined,
      undefined,
      "full",
      threadPaths
    );
    const lastArg = args[args.length - 1];
    expect(lastArg).toContain("reference conversation thread");
    expect(lastArg).toContain("abc123.json");
  });

  it("combines image and thread injection", () => {
    const imagePaths = ["/workspace/.entourage/uploads/img1.png"];
    const threadPaths = ["/workspace/.entourage/threads/abc123.json"];
    const { args } = getCliCommand(
      "claude",
      "hello",
      "session-1",
      false,
      undefined,
      imagePaths,
      "full",
      threadPaths
    );
    const prompt = args[args.indexOf("-p") + 1];
    expect(prompt).toContain("attached image");
    expect(prompt).toContain("reference conversation thread");
    expect(prompt).toContain("img1.png");
    expect(prompt).toContain("abc123.json");
  });
});
