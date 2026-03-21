export const QUICK_REPLY_INSTRUCTION = `\nAfter responding, append exactly one <QuickReply> block containing 1-3 brief follow-up suggestions the user might send. Put each suggestion inside its own <Option> tag, and never output any text after </QuickReply>.\n<QuickReply>\n<Option>suggestion text</Option>\n<Option>another suggestion</Option>\n</QuickReply>`;

const CLOSE_TAG = "</QuickReply>";
const OPEN_TAG = "<QuickReply>";
const OPTION_REGEX = /<Option>([\s\S]*?)<\/Option>/g;

function extractOptions(content: string): string[] {
  return Array.from(content.matchAll(OPTION_REGEX))
    .map((match) => match[1].trim())
    .filter((text) => text.length > 0);
}

/**
 * Only parses quick replies if the content ends with a well-formed, closed
 * <QuickReply>...</QuickReply> block. Dangling/incomplete blocks are never
 * parsed. If multiple blocks exist, only the very last one is considered —
 * and only if it is the last thing in the content.
 */
export function parseQuickReplies(content: string): { cleaned: string; suggestions: string[] } {
  const trimmed = content.trimEnd();

  // Must end with the close tag
  if (!trimmed.endsWith(CLOSE_TAG)) {
    return { cleaned: content, suggestions: [] };
  }

  // Find the last opening tag — that's the start of the only block we care about
  const lastOpen = trimmed.lastIndexOf(OPEN_TAG);
  if (lastOpen === -1) {
    return { cleaned: content, suggestions: [] };
  }

  const block = trimmed.slice(lastOpen);
  const suggestions = extractOptions(block);
  const cleaned = trimmed.slice(0, lastOpen).trimEnd();

  return { cleaned, suggestions: suggestions.slice(0, 3) };
}
