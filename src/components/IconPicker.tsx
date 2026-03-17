"use client";

import { useState } from "react";
import {
  Bot, Brain, Code, Terminal, Lightbulb, Shield, Zap, Search, Eye, Hammer,
  Wrench, Rocket, Target, Compass, BookOpen, Pencil, FileCode, Bug, Cpu,
  Database, Globe, Lock, Unlock, MessageSquare, Users, Star, Heart, Flag,
  Layers, GitBranch, Package, Settings, Sparkles, Wand2, Palette, Music,
  Camera, Microscope, Telescope, Beaker, Atom, Binary, CircuitBoard, Cog,
  Crown, Diamond, Flame, Gem, Leaf, Mountain, Skull, Swords,
} from "lucide-react";
import type { Icon } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Bot, Brain, Code, Terminal, Lightbulb, Shield, Zap, Search, Eye, Hammer,
  Wrench, Rocket, Target, Compass, BookOpen, Pencil, FileCode, Bug, Cpu,
  Database, Globe, Lock, Unlock, MessageSquare, Users, Star, Heart, Flag,
  Layers, GitBranch, Package, Settings, Sparkles, Wand2, Palette, Music,
  Camera, Microscope, Telescope, Beaker, Atom, Binary, CircuitBoard, Cog,
  Crown, Diamond, Flame, Gem, Leaf, Mountain, Skull, Swords,
};

const ICON_NAMES = Object.keys(ICON_MAP);

export function renderIcon(icon: Icon, className: string = "h-4 w-4") {
  if (icon.type === "emoji") {
    return <span className={className} style={{ fontSize: "1em", lineHeight: 1 }}>{icon.value}</span>;
  }
  if (icon.type === "image") {
    return <img src={`/api/workspace-icons/${icon.imageId}?ext=${icon.ext}`} alt="" className={`${className} rounded-full object-cover`} />;
  }
  const IconComponent = ICON_MAP[icon.name];
  if (!IconComponent) return <Bot className={className} />;
  return <IconComponent className={className} />;
}

export default function IconPicker({
  value,
  onChange,
}: {
  value?: Icon;
  onChange: (icon: Icon) => void;
}) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"lucide" | "emoji">(value?.type === "emoji" ? "emoji" : "lucide");
  const [emojiInput, setEmojiInput] = useState(value?.type === "emoji" ? value.value : "");

  const filtered = ICON_NAMES.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode("lucide")}
          className={`rounded px-2 py-1 text-xs font-medium ${
            mode === "lucide" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
          }`}
        >
          Icons
        </button>
        <button
          type="button"
          onClick={() => setMode("emoji")}
          className={`rounded px-2 py-1 text-xs font-medium ${
            mode === "emoji" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
          }`}
        >
          Emoji
        </button>
      </div>

      {mode === "lucide" ? (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="grid max-h-[160px] grid-cols-6 md:grid-cols-8 gap-1 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-600 p-2">
            {filtered.map((name) => {
              const LucideComp = ICON_MAP[name];
              const isSelected = value?.type === "lucide" && value.name === name;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => onChange({ type: "lucide", name })}
                  className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                    isSelected
                      ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 ring-1 ring-violet-500"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  <LucideComp className="h-4 w-4" />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-6 md:col-span-8 py-3 text-center text-xs text-zinc-400 dark:text-zinc-500">No icons found</div>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={emojiInput}
            onChange={(e) => {
              setEmojiInput(e.target.value);
              if (e.target.value.trim()) {
                onChange({ type: "emoji", value: e.target.value.trim() });
              }
            }}
            placeholder="Enter an emoji..."
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            maxLength={4}
          />
          {emojiInput && (
            <span className="text-2xl">{emojiInput}</span>
          )}
        </div>
      )}
    </div>
  );
}
