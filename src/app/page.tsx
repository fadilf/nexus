"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Workspace } from "@/lib/types";
import AddWorkspaceDialog from "@/components/AddWorkspaceDialog";

export default function RootPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [noWorkspaces, setNoWorkspaces] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((ws: Workspace[]) => {
        if (ws.length === 0) {
          setNoWorkspaces(true);
          setLoading(false);
          return;
        }
        const saved = localStorage.getItem("entourage-active-workspace");
        const match = ws.find((w) => w.id === saved);
        const targetId = match ? match.id : ws[0].id;
        router.replace(`/w/${targetId}`);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  if (noWorkspaces) {
    return (
      <div className="flex h-dvh overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
        <AddWorkspaceDialog
          open
          inline
          onClose={() => {}}
          onAdded={(ws: Workspace) => {
            router.replace(`/w/${ws.id}`);
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-dvh overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 items-center justify-center">
        <div className="h-4 w-48 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      </div>
    );
  }

  // Fetch failed — show error with retry
  return (
    <div className="flex h-dvh overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-sm text-zinc-500">Failed to load workspaces</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-violet-600 hover:underline"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
