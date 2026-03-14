"use client";

import { useState, useCallback, useRef } from "react";
import { Agent, MessageImage } from "@/lib/types";

type StreamingMessage = {
  agentId: string;
  content: string;
};

export function useAgentStream(
  threadId: string | null,
  onStreamComplete?: (threadId: string) => void,
  workspaceId?: string | null
) {
  // Store streams for ALL threads in a ref so they persist across threadId changes
  const allStreams = useRef<Map<string, Map<string, StreamingMessage>>>(
    new Map()
  );
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const [, setRenderTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const onCompleteRef = useRef(onStreamComplete);
  onCompleteRef.current = onStreamComplete;
  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;

  const triggerRender = useCallback(() => setRenderTick((t) => t + 1), []);

  const wsParam = useCallback(() => {
    const id = workspaceIdRef.current;
    return id ? `?workspaceId=${id}` : "";
  }, []);

  // Expose only the current thread's streaming messages (stable empty ref to avoid re-renders)
  const emptyMap = useRef(new Map<string, StreamingMessage>()).current;
  const streamingMessages = threadId
    ? allStreams.current.get(threadId) ?? emptyMap
    : emptyMap;
  const isStreaming = streamingMessages.size > 0;

  const streamAgent = useCallback(
    async (
      targetThreadId: string,
      agentId: string,
      prompt: string,
      images?: MessageImage[]
    ) => {
      const controllerKey = `${targetThreadId}:${agentId}`;
      const controller = new AbortController();
      abortControllers.current.set(controllerKey, controller);

      // Initialize streaming entry for this thread
      if (!allStreams.current.has(targetThreadId)) {
        allStreams.current.set(targetThreadId, new Map());
      }
      allStreams.current
        .get(targetThreadId)!
        .set(agentId, { agentId, content: "" });
      triggerRender();

      try {
        const res = await fetch(`/api/threads/${targetThreadId}/stream${wsParam()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            prompt,
            ...(images && images.length > 0 ? { images } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Stream failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            try {
              const event = JSON.parse(data);
              if (event.type === "content") {
                const threadStreams = allStreams.current.get(targetThreadId);
                if (threadStreams) {
                  const existing = threadStreams.get(agentId);
                  threadStreams.set(agentId, {
                    agentId,
                    content: (existing?.content ?? "") + event.text,
                  });
                  triggerRender();
                }
              } else if (event.type === "done") {
                break;
              } else if (event.type === "error") {
                setError(event.message);
              }
            } catch {
              // Not valid JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        abortControllers.current.delete(controllerKey);
        const threadStreams = allStreams.current.get(targetThreadId);
        if (threadStreams) {
          threadStreams.delete(agentId);
          if (threadStreams.size === 0) {
            allStreams.current.delete(targetThreadId);
            // All agents for this thread are done
            onCompleteRef.current?.(targetThreadId);
          }
        }
        triggerRender();
      }
    },
    [triggerRender, wsParam]
  );

  const sendMessage = useCallback(
    async (content: string, targetAgents: Agent[], images?: MessageImage[]) => {
      if (!threadId) return;
      const currentThreadId = threadId;
      setError(null);

      await Promise.all(
        targetAgents.map((agent) =>
          streamAgent(currentThreadId, agent.id, content, images)
        )
      );
    },
    [threadId, streamAgent]
  );

  const stopAgent = useCallback(
    async (agentId: string) => {
      if (!threadId) return;
      const controllerKey = `${threadId}:${agentId}`;
      abortControllers.current.get(controllerKey)?.abort();
      await fetch(`/api/threads/${threadId}/stop${wsParam()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
    },
    [threadId, wsParam]
  );

  return {
    streamingMessages,
    isStreaming,
    error,
    sendMessage,
    stopAgent,
  };
}
