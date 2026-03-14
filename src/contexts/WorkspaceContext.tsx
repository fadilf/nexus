"use client";

import { createContext, useContext } from "react";

const WorkspaceContext = createContext<string | null>(null);

export function WorkspaceProvider({ workspaceId, children }: { workspaceId: string | null; children: React.ReactNode }) {
  return <WorkspaceContext value={workspaceId}>{children}</WorkspaceContext>;
}

export function useWorkspaceId(): string | null {
  return useContext(WorkspaceContext);
}

export function useWsParam(): string {
  const id = useContext(WorkspaceContext);
  return id ? `?workspaceId=${id}` : "";
}
