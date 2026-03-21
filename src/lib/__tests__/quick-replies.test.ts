import { describe, it, expect } from "vitest";
import { parseQuickReplies } from "../quick-replies";

describe("parseQuickReplies", () => {
  it("extracts suggestions from a well-formed block", () => {
    const content = `Here is my answer.\n<QuickReply>\n<Option>Do X</Option>\n<Option>Do Y</Option>\n</QuickReply>`;
    const result = parseQuickReplies(content);
    expect(result.cleaned).toBe("Here is my answer.");
    expect(result.suggestions).toEqual(["Do X", "Do Y"]);
  });

  it("returns empty suggestions when no block present", () => {
    const result = parseQuickReplies("Just a plain response.");
    expect(result.cleaned).toBe("Just a plain response.");
    expect(result.suggestions).toEqual([]);
  });

  it("ignores incomplete/dangling blocks", () => {
    const content = "Response\n<QuickReply>\n<Option>A</Option>";
    const result = parseQuickReplies(content);
    expect(result.suggestions).toEqual([]);
  });

  it("ignores close tag without open tag", () => {
    const content = "Response\n</QuickReply>";
    const result = parseQuickReplies(content);
    expect(result.suggestions).toEqual([]);
  });

  it("caps at 3 suggestions", () => {
    const content = `Hi\n<QuickReply>\n<Option>A</Option>\n<Option>B</Option>\n<Option>C</Option>\n<Option>D</Option>\n</QuickReply>`;
    const result = parseQuickReplies(content);
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions).toEqual(["A", "B", "C"]);
  });

  it("uses only the last block when multiple exist", () => {
    const content = `Text\n<QuickReply>\n<Option>Old</Option>\n</QuickReply>\nMore text\n<QuickReply>\n<Option>New</Option>\n</QuickReply>`;
    const result = parseQuickReplies(content);
    expect(result.suggestions).toEqual(["New"]);
  });

  it("trims whitespace around options", () => {
    const content = `Answer\n<QuickReply>\n<Option>  spaced  </Option>\n</QuickReply>`;
    const result = parseQuickReplies(content);
    expect(result.suggestions).toEqual(["spaced"]);
  });

  it("skips empty options", () => {
    const content = `Answer\n<QuickReply>\n<Option></Option>\n<Option>Valid</Option>\n</QuickReply>`;
    const result = parseQuickReplies(content);
    expect(result.suggestions).toEqual(["Valid"]);
  });

  it("handles trailing whitespace after close tag", () => {
    const content = `Answer\n<QuickReply>\n<Option>A</Option>\n</QuickReply>   \n`;
    const result = parseQuickReplies(content);
    expect(result.suggestions).toEqual(["A"]);
  });
});
