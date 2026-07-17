"use client";

import { cn } from "@/lib/utils";

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}

/** Accessible switch-style toggle used in banner config panels. */
export default function ToggleRow({ label, checked, onChange, id }: Props) {
  const inputId = id ?? `toggle-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={inputId} className="text-sm cursor-pointer select-none">
        {label}
      </label>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          checked
            ? "border-primary bg-primary"
            : "border-input bg-muted"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block size-3.5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          )}
        />
      </button>
    </div>
  );
}
