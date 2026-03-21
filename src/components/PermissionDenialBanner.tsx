"use client";

import { ShieldAlert } from "lucide-react";
import { PermissionDenial, PermissionLevel } from "@/lib/types";

function summarizeDenial(denial: PermissionDenial): string {
  const input = denial.toolInput;
  if (!input) return denial.toolName;

  // Extract the most useful path/command from common tool inputs
  if (typeof input.file_path === "string") {
    return `${denial.toolName} \u2192 ${input.file_path}`;
  }
  if (typeof input.command === "string") {
    const cmd = input.command as string;
    return `${denial.toolName} \u2192 ${cmd.length > 60 ? cmd.slice(0, 60) + "\u2026" : cmd}`;
  }
  return denial.toolName;
}

export default function PermissionDenialBanner({
  denials,
  currentLevel,
  onChangeLevel,
}: {
  denials: PermissionDenial[];
  currentLevel?: PermissionLevel;
  onChangeLevel?: (level: PermissionLevel) => void;
}) {
  if (!denials.length) return null;

  // Deduplicate by toolName
  const uniqueTools = [...new Set(denials.map((d) => d.toolName))];
  const showDetails = denials.length <= 5;

  return (
    <div className="mt-1.5 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
        <ShieldAlert className="h-3.5 w-3.5" />
        <span>
          {denials.length === 1
            ? "1 action was blocked"
            : `${denials.length} actions were blocked`}
        </span>
      </div>
      {showDetails ? (
        <ul className="mt-1 space-y-0.5 text-amber-700 dark:text-amber-400">
          {denials.map((d, i) => (
            <li key={i} className="font-mono truncate">
              {summarizeDenial(d)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-amber-700 dark:text-amber-400">
          Blocked tools: {uniqueTools.join(", ")}
        </p>
      )}
      {onChangeLevel && (
        <div className="mt-2 flex gap-2">
          {currentLevel === "supervised" && (
            <button
              onClick={() => onChangeLevel("auto-edit")}
              className="rounded bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
            >
              Allow Edits
            </button>
          )}
          <button
            onClick={() => onChangeLevel("full")}
            className="rounded bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
          >
            Full Autonomy
          </button>
        </div>
      )}
    </div>
  );
}
