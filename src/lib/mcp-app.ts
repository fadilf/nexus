import { ContentBlock, McpAppBlock, ToolCall } from "./types";

type JsonObject = Record<string, unknown>;

type Candidate = {
  html?: string;
  resourceUri?: string;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeHtmlCandidate(value: unknown): string | undefined {
  return typeof value === "string" && /<(html|body|div|main|section|script|style|iframe)\b/i.test(value)
    ? value
    : undefined;
}

function collectFromContentEntry(entry: unknown): Candidate | null {
  if (!isObject(entry)) return null;

  const mimeType = typeof entry.mimeType === "string" ? entry.mimeType : undefined;
  const text = typeof entry.text === "string" ? entry.text : undefined;
  const uri = typeof entry.uri === "string" ? entry.uri : undefined;
  const blob = typeof entry.blob === "string" ? entry.blob : undefined;

  if (mimeType === "text/html") {
    return {
      html: text ?? blob,
      resourceUri: uri,
    };
  }

  if (uri?.startsWith("ui://")) {
    return {
      html: text ?? blob,
      resourceUri: uri,
    };
  }

  return null;
}

function collectCandidate(value: unknown): Candidate | null {
  if (!value) return null;

  const html = normalizeHtmlCandidate(value);
  if (html) return { html };

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = collectCandidate(entry);
      if (candidate?.html) return candidate;
    }
    return null;
  }

  if (!isObject(value)) return null;

  const directHtml =
    normalizeHtmlCandidate(value.html) ??
    normalizeHtmlCandidate(value.contents) ??
    normalizeHtmlCandidate(value.template) ??
    normalizeHtmlCandidate(value.text);
  const resourceUri = typeof value.resourceUri === "string"
    ? value.resourceUri
    : typeof value.uri === "string"
      ? value.uri
      : undefined;

  if (directHtml) {
    return { html: directHtml, resourceUri };
  }

  if (Array.isArray(value.contents)) {
    for (const entry of value.contents) {
      const candidate = collectFromContentEntry(entry) ?? collectCandidate(entry);
      if (candidate?.html) {
        return {
          html: candidate.html,
          resourceUri: candidate.resourceUri ?? resourceUri,
        };
      }
    }
  }

  if (Array.isArray(value.content)) {
    for (const entry of value.content) {
      const candidate = collectFromContentEntry(entry) ?? collectCandidate(entry);
      if (candidate?.html) {
        return {
          html: candidate.html,
          resourceUri: candidate.resourceUri ?? resourceUri,
        };
      }
    }
  }

  if (isObject(value.result)) {
    const candidate = collectCandidate(value.result);
    if (candidate?.html) return candidate;
  }

  if (isObject(value.structuredContent)) {
    const candidate = collectCandidate(value.structuredContent);
    if (candidate?.html) return candidate;
  }

  const metaValue = isObject(value._meta) ? (value._meta as JsonObject) : null;
  if (metaValue) {
    const meta = metaValue;
    const ui = isObject(meta.ui) ? meta.ui : meta;
    const candidate = collectCandidate(ui);
    if (candidate?.html) return candidate;
    if (!resourceUri) {
      const metaUri = typeof ui.resourceUri === "string" ? ui.resourceUri : undefined;
      if (metaUri) return { resourceUri: metaUri };
    }
  }

  return resourceUri ? { resourceUri } : null;
}

export function extractMcpAppPayload(output?: string | null): Candidate | null {
  if (!output) return null;

  const directHtml = normalizeHtmlCandidate(output);
  if (directHtml) return { html: directHtml };

  try {
    const parsed = JSON.parse(output) as unknown;
    const candidate = collectCandidate(parsed);
    return candidate?.html ? candidate : null;
  } catch {
    return null;
  }
}

export function createMcpAppBlock(toolCall: ToolCall): McpAppBlock | null {
  const payload = extractMcpAppPayload(toolCall.output);
  if (!payload?.html) return null;

  return {
    type: "mcp_app",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    resourceUri: payload.resourceUri,
    html: payload.html,
  };
}

export function upsertContentBlock(blocks: ContentBlock[], toolCall: ToolCall): ContentBlock[] {
  const blockIndex = blocks.findIndex(
    (block) =>
      (block.type === "tool_call" && block.toolCall.id === toolCall.id) ||
      (block.type === "mcp_app" && block.toolCallId === toolCall.id)
  );

  const nextBlocks = [...blocks];
  const mcpAppBlock = createMcpAppBlock(toolCall);
  const replacement: ContentBlock = mcpAppBlock ?? { type: "tool_call", toolCall };

  if (blockIndex >= 0) {
    nextBlocks[blockIndex] = replacement;
  } else {
    nextBlocks.push(replacement);
  }

  return nextBlocks;
}
