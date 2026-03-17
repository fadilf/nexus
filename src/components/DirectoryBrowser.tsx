"use client";

import { useState, useEffect, useRef } from "react";
import { Folder, File, ChevronRight, Pencil } from "lucide-react";

type Entry = { name: string; type: "directory" | "file" };

type Props = {
  value: string;
  onChange: (path: string) => void;
};

export default function DirectoryBrowser({ value, onChange }: Props) {
  const [currentPath, setCurrentPath] = useState(value || "");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const pathInputRef = useRef<HTMLInputElement>(null);

  const browse = async (dirPath?: string) => {
    setLoading(true);
    setError("");
    try {
      const url = dirPath
        ? `/api/browse?path=${encodeURIComponent(dirPath)}`
        : "/api/browse";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to browse");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCurrentPath(data.path);
      setEntries(data.entries);
      onChange(data.path);
    } catch {
      setError("Failed to browse directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    browse(value || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const segments = currentPath.split("/").filter(Boolean);

  const navigateTo = (dir: string) => {
    browse(dir);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = "/" + segments.slice(0, index + 1).join("/");
    navigateTo(target);
  };

  const startEditingPath = () => {
    setPathInput(currentPath);
    setEditingPath(true);
    setTimeout(() => pathInputRef.current?.focus(), 0);
  };

  const submitPathEdit = () => {
    setEditingPath(false);
    if (pathInput.trim() && pathInput.trim() !== currentPath) {
      navigateTo(pathInput.trim());
    }
  };

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      submitPathEdit();
    } else if (e.key === "Escape") {
      setEditingPath(false);
    }
  };

  return (
    <div className="border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden bg-white dark:bg-zinc-700">
      {/* Breadcrumb / path bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-600 min-h-[36px]">
        {editingPath ? (
          <input
            ref={pathInputRef}
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onBlur={submitPathEdit}
            onKeyDown={handlePathKeyDown}
            className="flex-1 text-sm bg-white dark:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-500 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        ) : (
          <>
            <div className="flex-1 flex items-center gap-0.5 overflow-x-auto text-sm min-w-0">
              <button
                onClick={() => navigateTo("/")}
                className="shrink-0 px-1 py-0.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600"
              >
                /
              </button>
              {segments.map((seg, i) => (
                <span key={i} className="flex items-center gap-0.5 shrink-0">
                  <ChevronRight size={12} className="text-zinc-400 dark:text-zinc-500" />
                  <button
                    onClick={() => handleBreadcrumbClick(i)}
                    className={`px-1 py-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600 truncate max-w-[120px] ${
                      i === segments.length - 1
                        ? "text-zinc-900 dark:text-zinc-100 font-medium"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                    title={seg}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>
            <button
              onClick={startEditingPath}
              className="shrink-0 p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600"
              title="Edit path"
            >
              <Pencil size={14} />
            </button>
          </>
        )}
      </div>

      {/* File list */}
      <div className="max-h-[240px] overflow-y-auto">
        {loading ? (
          <div className="px-3 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
            Loading...
          </div>
        ) : error ? (
          <div className="px-3 py-6 text-center text-sm text-red-500 dark:text-red-400">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
            Empty directory
          </div>
        ) : (
          <div>
            {/* Navigate up */}
            {segments.length > 0 && (
              <button
                onClick={() => navigateTo("/" + segments.slice(0, -1).join("/") || "/")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-600 text-left"
              >
                <Folder size={16} className="shrink-0" />
                <span>..</span>
              </button>
            )}
            {entries.map((entry) => (
              <button
                key={entry.name}
                onClick={
                  entry.type === "directory"
                    ? () => navigateTo(currentPath + (currentPath.endsWith("/") ? "" : "/") + entry.name)
                    : undefined
                }
                disabled={entry.type === "file"}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left ${
                  entry.type === "directory"
                    ? "text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-600 cursor-pointer"
                    : "text-zinc-400 dark:text-zinc-500 cursor-default"
                }`}
              >
                {entry.type === "directory" ? (
                  <Folder size={16} className="shrink-0 text-violet-500" />
                ) : (
                  <File size={16} className="shrink-0" />
                )}
                <span className="truncate">{entry.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
