"use client";

import { useWorkspaceLayout } from "@/contexts/WorkspaceLayoutContext";

export default function WorkspacePage() {
  const { isMobile } = useWorkspaceLayout();

  // On mobile, the thread list is shown by the layout when no threadId is in the URL.
  // On desktop, this page fills the main content area with an empty state.
  if (isMobile) return null;

  return (
    <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
      <p className="text-sm">Select a thread or start a new one</p>
    </div>
  );
}
