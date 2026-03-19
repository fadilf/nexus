# Demoing MCP app rendering

A quick way to verify the feature is to use any MCP tool that returns **inline HTML** (or a `ui://...` resource payload resolved to HTML) in its tool result.

## Minimal demo flow

1. Start Entourage against any local project:

   ```bash
   npx @fadilf/entourage
   ```

2. Open a thread with an agent whose CLI already has access to an MCP server that exposes a simple UI/demo tool.

3. Send a prompt like:

   ```text
   Use the demo MCP tool and show me the UI it returns.
   ```

4. Confirm the chat shows this sequence:
   - a tool call row appears while the tool is running
   - once the tool finishes, the row is replaced by an embedded app card
   - the app renders inside a sandboxed iframe directly in the message stream

## What kind of tool result works?

Entourage looks for tool outputs that contain HTML in common MCP-style shapes, including:

- a direct HTML string
- `content` / `contents` entries with `mimeType: "text/html"`
- payloads that reference a `ui://...` resource and include the resolved HTML

## Example prompt ideas

- `Run the sample dashboard MCP tool.`
- `Open the demo widget from the MCP server.`
- `Use the UI tool and summarize what it shows after rendering it.`

If the tool only returns plain text or JSON with no embedded HTML, Entourage will keep showing the normal tool call block instead of an app iframe.
