export type BannerThemePreset = {
  name: string;
  from: string;
  to: string;
  text: string;
  muted: string;
  accent: string;
};

/** First-party teal preset aligned with the app icon, then popular themes. */
export const BANNER_THEME_PRESETS: BannerThemePreset[] = [
  {
    name: "Daily Stats",
    from: "#0f3d42",
    to: "#2D8E97",
    text: "#f0fdfa",
    muted: "#99d5db",
    accent: "#5eead4",
  },
  {
    name: "Claude",
    from: "#B05730",
    to: "#9C87F5",
    text: "#C3C0B6",
    muted: "#B7B5A9",
    accent: "#D97757",
  },
  {
    name: "Vercel",
    from: "#FFAE04",
    to: "#2671F4",
    text: "#FFFFFF",
    muted: "#A4A4A4",
    accent: "#FFFFFF",
  },
  {
    name: "Supabase",
    from: "#4ADE80",
    to: "#60A5FA",
    text: "#E2E8F0",
    muted: "#A2A2A2",
    accent: "#006239",
  },
  {
    name: "Ocean",
    from: "#1e3c72",
    to: "#2a5298",
    text: "#ffffff",
    muted: "#cbd5f5",
    accent: "#fbd38d",
  },
  {
    name: "Sunset",
    from: "#f7971e",
    to: "#ff416c",
    text: "#ffffff",
    muted: "#ffe3cc",
    accent: "#fff2cc",
  },
  {
    name: "Forest",
    from: "#0f766e",
    to: "#22c55e",
    text: "#ecfdf5",
    muted: "#c2f0d8",
    accent: "#facc15",
  },
  {
    name: "Midnight",
    from: "#0f172a",
    to: "#1f2937",
    text: "#f8fafc",
    muted: "#cbd5f5",
    accent: "#a5b4fc",
  },
  {
    name: "Lavender",
    from: "#8b5cf6",
    to: "#ec4899",
    text: "#ffffff",
    muted: "#f5d0fe",
    accent: "#fde047",
  },
  {
    name: "Stone",
    from: "#334155",
    to: "#94a3b8",
    text: "#f8fafc",
    muted: "#e2e8f0",
    accent: "#f8fafc",
  },
];

export const DEFAULT_BANNER_THEME = BANNER_THEME_PRESETS[0];

export const BANNER_DIRECTIONS = [
  { value: "to-r", label: "→  Horizontal" },
  { value: "to-b", label: "↓  Vertical" },
  { value: "to-br", label: "↘  Diagonal" },
  { value: "to-tr", label: "↗  Diagonal (reverse)" },
] as const;

export type BannerDirection = (typeof BANNER_DIRECTIONS)[number]["value"];
