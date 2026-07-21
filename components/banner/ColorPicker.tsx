"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";

export default function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <label
        htmlFor={id}
        className="flex items-center gap-2.5 h-9 rounded-md border border-input px-3 cursor-pointer hover:bg-accent/40 transition-colors"
      >
        <span
          className="w-5 h-5 rounded-sm border border-border shrink-0"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        <span className="text-sm font-mono flex-1 text-foreground">{value}</span>
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </label>
    </div>
  );
}
