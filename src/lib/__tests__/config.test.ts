import { describe, it, expect } from "vitest";
import { getCliCommand } from "../config";

describe("getCliCommand", () => {
  describe("claude", () => {
    it("produces base command with stream-json output", () => {
      const { cmd, args } = getCliCommand("claude", "hello", "s1", false);
      expect(cmd).toBe("claude");
      expect(args).toContain("-p");
      expect(args).toContain("--output-format");
      expect(args).toContain("stream-json");
      expect(args).toContain("--verbose");
      expect(args).toContain("--session-id");
    });

    it("uses --resume for resumed sessions", () => {
      const { args } = getCliCommand("claude", "hi", "s1", true);
      expect(args).toContain("--resume");
      expect(args).toContain("s1");
      expect(args).not.toContain("--session-id");
    });

    it("adds --dangerously-skip-permissions for full permission", () => {
      const { args } = getCliCommand("claude", "hi", "s1", false, undefined, undefined, "full");
      expect(args).toContain("--dangerously-skip-permissions");
    });

    it("adds --permission-mode acceptEdits for auto-edit", () => {
      const { args } = getCliCommand("claude", "hi", "s1", false, undefined, undefined, "auto-edit");
      expect(args).toContain("--permission-mode");
      expect(args).toContain("acceptEdits");
    });

    it("adds no permission flag for supervised", () => {
      const { args } = getCliCommand("claude", "hi", "s1", false, undefined, undefined, "supervised");
      expect(args).not.toContain("--dangerously-skip-permissions");
      expect(args).not.toContain("--permission-mode");
    });

    it("appends personality as system prompt", () => {
      const { args } = getCliCommand("claude", "hi", "s1", false, "be nice");
      expect(args).toContain("--append-system-prompt");
      expect(args).toContain("be nice");
    });
  });

  describe("gemini", () => {
    it("produces base gemini command", () => {
      const { cmd, args } = getCliCommand("gemini", "hello", "s1", false);
      expect(cmd).toBe("gemini");
      expect(args).toContain("-p");
      expect(args).toContain("--output-format");
      expect(args).toContain("stream-json");
    });

    it("adds --yolo for full permission", () => {
      const { args } = getCliCommand("gemini", "hi", "s1", false, undefined, undefined, "full");
      expect(args).toContain("--yolo");
    });

    it("adds --approval-mode auto_edit for auto-edit", () => {
      const { args } = getCliCommand("gemini", "hi", "s1", false, undefined, undefined, "auto-edit");
      expect(args).toContain("--approval-mode");
      expect(args).toContain("auto_edit");
    });

    it("prepends personality as system instructions in prompt", () => {
      const { args } = getCliCommand("gemini", "hello", "s1", false, "be helpful");
      const promptIdx = args.indexOf("-p") + 1;
      expect(args[promptIdx]).toContain("[System Instructions]");
      expect(args[promptIdx]).toContain("be helpful");
      expect(args[promptIdx]).toContain("hello");
    });
  });

  describe("codex", () => {
    it("produces base codex command", () => {
      const { cmd, args } = getCliCommand("codex", "hello", "s1", false);
      expect(cmd).toBe("codex");
      expect(args).toContain("exec");
      expect(args).toContain("--json");
    });

    it("uses exec resume for resumed sessions", () => {
      const { args } = getCliCommand("codex", "hi", "s1", true);
      expect(args).toContain("exec");
      expect(args).toContain("resume");
      expect(args).toContain("s1");
    });

    it("adds bypass flag for full permission", () => {
      const { args } = getCliCommand("codex", "hi", "s1", false, undefined, undefined, "full");
      expect(args).toContain("--dangerously-bypass-approvals-and-sandbox");
    });

    it("adds workspace-write sandbox for auto-edit", () => {
      const { args } = getCliCommand("codex", "hi", "s1", false, undefined, undefined, "auto-edit");
      expect(args).toContain("-s");
      expect(args).toContain("workspace-write");
    });

    it("prepends personality in prompt", () => {
      const { args } = getCliCommand("codex", "hello", "s1", false, "be terse");
      const prompt = args[args.length - 1];
      expect(prompt).toContain("[System Instructions]");
      expect(prompt).toContain("be terse");
      expect(prompt).toContain("hello");
    });

    it("adds --image= flags for images", () => {
      const { args } = getCliCommand("codex", "look", "s1", false, undefined, ["/a.png", "/b.png"]);
      expect(args).toContain("--image=/a.png");
      expect(args).toContain("--image=/b.png");
    });
  });

  describe("image handling", () => {
    it("adds image instructions to prompt for claude", () => {
      const { args } = getCliCommand("claude", "describe this", "s1", false, undefined, ["/img.png"]);
      const promptIdx = args.indexOf("-p") + 1;
      expect(args[promptIdx]).toContain("attached image(s)");
      expect(args[promptIdx]).toContain("/img.png");
    });
  });

  describe("thread injection", () => {
    it("injects thread reference paths into claude prompt", () => {
      const threadPaths = ["/workspace/.entourage/threads/abc123.json"];
      const { args } = getCliCommand("claude", "hello", "s1", false, undefined, undefined, "full", threadPaths);
      const prompt = args[args.indexOf("-p") + 1];
      expect(prompt).toContain("reference conversation thread");
      expect(prompt).toContain("MUST NOT modify");
      expect(prompt).toContain("abc123.json");
      expect(prompt).toContain("User message: hello");
    });

    it("does not inject thread text when no threadPaths provided", () => {
      const { args } = getCliCommand("claude", "hello", "s1", false);
      const prompt = args[args.indexOf("-p") + 1];
      expect(prompt).not.toContain("reference conversation thread");
      expect(prompt).toBe("hello");
    });

    it("combines image and thread injection", () => {
      const { args } = getCliCommand("claude", "hello", "s1", false, undefined, ["/img.png"], "full", ["/thread.json"]);
      const prompt = args[args.indexOf("-p") + 1];
      expect(prompt).toContain("attached image");
      expect(prompt).toContain("reference conversation thread");
    });
  });
});
