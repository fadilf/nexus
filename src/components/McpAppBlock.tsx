"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AppWindow, ChevronRight, ExternalLink } from "lucide-react";
import { McpAppBlock as McpAppBlockType } from "@/lib/types";

function buildSrcDoc(html: string, frameId: string): string {
  const resizeScript = `
<script>
(function () {
  const frameId = ${JSON.stringify(frameId)};
  const postHeight = () => {
    const body = document.body;
    const doc = document.documentElement;
    const height = Math.max(
      body ? body.scrollHeight : 0,
      doc ? doc.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      doc ? doc.offsetHeight : 0,
      240
    );
    parent.postMessage({ source: 'entourage-mcp-app', frameId, height }, '*');
  };

  window.addEventListener('load', postHeight);
  window.addEventListener('resize', postHeight);
  new MutationObserver(postHeight).observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true,
  });
  setInterval(postHeight, 1000);
})();
</script>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${resizeScript}</body>`);
  }

  return `${html}${resizeScript}`;
}

export default function McpAppBlock({ block }: { block: McpAppBlockType }) {
  const [expanded, setExpanded] = useState(true);
  const [height, setHeight] = useState(320);
  const reactId = useId();
  const frameId = useMemo(() => reactId.replace(/:/g, ""), [reactId]);
  const srcDoc = useMemo(() => buildSrcDoc(block.html, frameId), [block.html, frameId]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; frameId?: string; height?: number };
      if (data?.source !== "entourage-mcp-app" || data.frameId !== frameId || typeof data.height !== "number") {
        return;
      }
      setHeight(Math.min(Math.max(Math.ceil(data.height), 240), 720));
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameId]);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm dark:border-violet-900/60 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 border-b border-violet-100 bg-violet-50/70 px-3 py-2 text-left text-sm hover:bg-violet-100/80 dark:border-violet-900/60 dark:bg-violet-950/40 dark:hover:bg-violet-950/60"
      >
        <ChevronRight className={`h-4 w-4 shrink-0 text-violet-500 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <AppWindow className="h-4 w-4 shrink-0 text-violet-500" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">{block.toolName}</div>
          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {block.resourceUri ?? "Interactive MCP app"}
          </div>
        </div>
        {block.resourceUri && (
          <span className="hidden items-center gap-1 text-xs text-violet-600 dark:text-violet-300 sm:inline-flex">
            <ExternalLink className="h-3 w-3" />
            ui:// resource
          </span>
        )}
      </button>

      {expanded && (
        <div className="bg-zinc-50 p-2 dark:bg-zinc-950/40">
          <iframe
            title={`${block.toolName} MCP app`}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-modals"
            className="w-full rounded-md border border-zinc-200 bg-white dark:border-zinc-800"
            style={{ height }}
          />
        </div>
      )}
    </div>
  );
}
