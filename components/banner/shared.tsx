"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";

export type ThemePreset = {
  name: string;
  from: string;
  to: string;
  text: string;
  muted: string;
  accent?: string;
};

export const BANNER_PRESETS: ThemePreset[] = [
  { name: "Claude", from: "#B05730", to: "#9C87F5", text: "#C3C0B6", muted: "#B7B5A9", accent: "#D97757" },
  { name: "Vercel", from: "#FFAE04", to: "#2671F4", text: "#FFFFFF", muted: "#A4A4A4", accent: "#FFFFFF" },
  { name: "Supabase", from: "#4ADE80", to: "#60A5FA", text: "#E2E8F0", muted: "#A2A2A2", accent: "#006239" },
  { name: "Ocean", from: "#1e3c72", to: "#2a5298", text: "#ffffff", muted: "#cbd5f5", accent: "#fbd38d" },
  { name: "Sunset", from: "#f7971e", to: "#ff416c", text: "#ffffff", muted: "#ffe3cc", accent: "#fff2cc" },
  { name: "Forest", from: "#0f766e", to: "#22c55e", text: "#ecfdf5", muted: "#c2f0d8", accent: "#facc15" },
  { name: "Midnight", from: "#0f172a", to: "#1f2937", text: "#f8fafc", muted: "#cbd5f5", accent: "#a5b4fc" },
  { name: "Lavender", from: "#8b5cf6", to: "#ec4899", text: "#ffffff", muted: "#f5d0fe", accent: "#fde047" },
  { name: "Stone", from: "#334155", to: "#94a3b8", text: "#f8fafc", muted: "#e2e8f0", accent: "#f8fafc" },
];

export const BANNER_DIRECTIONS = [
  { value: "to-r", label: "→  Horizontal" },
  { value: "to-b", label: "↓  Vertical" },
  { value: "to-br", label: "↘  Diagonal" },
  { value: "to-tr", label: "↗  Diagonal (reverse)" },
] as const;

export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputId = `color-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <label
        htmlFor={inputId}
        className="flex items-center gap-2.5 h-9 rounded-md border border-input px-3 cursor-pointer hover:bg-accent/40 transition-colors"
      >
        <span
          className="w-5 h-5 rounded-sm border border-border shrink-0"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        <span className="text-sm font-mono flex-1 text-foreground">{value}</span>
        <input
          id={inputId}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </label>
    </div>
  );
}

export function PresetSwatches({
  presets,
  current,
  onSelect,
}: {
  presets: ThemePreset[];
  current: { from: string; to: string; text: string; muted: string; accent?: string };
  onSelect: (preset: ThemePreset) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Color presets">
      {presets.map((p) => {
        const selected =
          current.from.toLowerCase() === p.from.toLowerCase() &&
          current.to.toLowerCase() === p.to.toLowerCase() &&
          current.text.toLowerCase() === p.text.toLowerCase() &&
          current.muted.toLowerCase() === p.muted.toLowerCase() &&
          (!p.accent ||
            !current.accent ||
            current.accent.toLowerCase() === p.accent.toLowerCase());

        return (
          <button
            key={p.name}
            type="button"
            aria-label={`${p.name} preset`}
            aria-pressed={selected}
            title={p.name}
            onClick={() => onSelect(p)}
            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
              selected
                ? "border-ring ring-2 ring-ring/40 scale-110"
                : "border-transparent hover:border-ring"
            }`}
            style={{
              background: `linear-gradient(to bottom right, ${p.from}, ${p.to})`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Debounce a value; useful for preview URLs driven by free-text input. */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
