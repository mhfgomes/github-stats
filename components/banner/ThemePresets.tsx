"use client";

import { cn } from "@/lib/utils";
import {
  BANNER_THEME_PRESETS,
  type BannerThemePreset,
} from "@/lib/banner-presets";

type ThemePresetsProps = {
  selected: Pick<
    BannerThemePreset,
    "from" | "to" | "text" | "muted" | "accent"
  >;
  onSelect: (preset: BannerThemePreset) => void;
  /** When false, accent is ignored for selection matching (languages banner). */
  matchAccent?: boolean;
};

export default function ThemePresets({
  selected,
  onSelect,
  matchAccent = true,
}: ThemePresetsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="listbox" aria-label="Color presets">
      {BANNER_THEME_PRESETS.map((p) => {
        const selectedMatch =
          selected.from === p.from &&
          selected.to === p.to &&
          selected.text === p.text &&
          selected.muted === p.muted &&
          (!matchAccent || selected.accent === p.accent);

        return (
          <button
            key={p.name}
            type="button"
            title={p.name}
            aria-label={`${p.name} preset`}
            aria-selected={selectedMatch}
            role="option"
            onClick={() => onSelect(p)}
            className={cn(
              "w-7 h-7 rounded-full border-2 transition-all",
              selectedMatch
                ? "border-foreground scale-110 ring-2 ring-ring/40"
                : "border-transparent hover:border-ring hover:scale-110"
            )}
            style={{
              background: `linear-gradient(to bottom right, ${p.from}, ${p.to})`,
            }}
          />
        );
      })}
    </div>
  );
}
