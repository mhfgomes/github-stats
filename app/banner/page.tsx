"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";

interface BannerConfig {
  username: string;
  range: "today" | "yesterday" | "last7" | "lastweek" | "thismonth" | "lastmonth";
  title: string;
  subtitle: string;
  showTitle: boolean;
  showSubtitle: boolean;
  showCommits: boolean;
  showAdditions: boolean;
  showDeletions: boolean;
  showNet: boolean;
  topRepos: number;
  width: number;
  height: number;
  gradientFrom: string;
  gradientTo: string;
  direction: "to-r" | "to-b" | "to-br" | "to-tr";
  textColor: string;
  mutedColor: string;
  accentColor: string;
}

type ThemePreset = {
  name: string;
  from: string;
  to: string;
  text: string;
  muted: string;
  accent: string;
};

const PRESETS: ThemePreset[] = [
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

const DIRECTIONS = [
  { value: "to-r", label: "→  Horizontal" },
  { value: "to-b", label: "↓  Vertical" },
  { value: "to-br", label: "↘  Diagonal" },
  { value: "to-tr", label: "↗  Diagonal (reverse)" },
] as const;

const HEIGHTS = [
  { value: 180, label: "Compact  (180 px)" },
  { value: 240, label: "Medium   (240 px)" },
  { value: 300, label: "Tall     (300 px)" },
  { value: 380, label: "Hero     (380 px)" },
];

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "lastweek", label: "Last week" },
  { value: "thismonth", label: "This month" },
  { value: "lastmonth", label: "Last month" },
] as const;

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeLabel(key: BannerConfig["range"]) {
  const option = RANGE_OPTIONS.find((r) => r.value === key);
  return option?.label ?? "Last 7 days";
}

function rangeDates(key: BannerConfig["range"]) {
  const today = new Date();
  const todayStr = formatDate(today);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start);

  if (key === "today") return { from: todayStr, to: todayStr };
  if (key === "yesterday") {
    start.setUTCDate(start.getUTCDate() - 1);
    const d = formatDate(start);
    return { from: d, to: d };
  }
  if (key === "last7") {
    start.setUTCDate(start.getUTCDate() - 6);
    return { from: formatDate(start), to: todayStr };
  }
  if (key === "lastweek") {
    const day = start.getUTCDay();
    const mondayOffset = (day + 6) % 7;
    start.setUTCDate(start.getUTCDate() - mondayOffset - 7);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: formatDate(start), to: formatDate(end) };
  }
  if (key === "thismonth") {
    start.setUTCDate(1);
    return { from: formatDate(start), to: todayStr };
  }
  if (key === "lastmonth") {
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth();
    const firstOfLast = new Date(Date.UTC(year, month - 1, 1));
    const lastOfLast = new Date(Date.UTC(year, month, 0));
    return { from: formatDate(firstOfLast), to: formatDate(lastOfLast) };
  }
  return { from: todayStr, to: todayStr };
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <label className="flex items-center gap-2.5 h-9 rounded-md border border-input px-3 cursor-pointer hover:bg-accent/40 transition-colors">
        <span
          className="w-5 h-5 rounded-sm border border-border shrink-0"
          style={{ backgroundColor: value }}
        />
        <span className="text-sm font-mono flex-1 text-foreground">
          {value}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </label>
    </div>
  );
}

const DEFAULT_CONFIG: BannerConfig = {
  username: "",
  range: "last7",
  title: "",
  subtitle: "",
  showTitle: true,
  showSubtitle: true,
  showCommits: true,
  showAdditions: true,
  showDeletions: true,
  showNet: false,
  topRepos: 3,
  width: 900,
  height: 240,
  gradientFrom: PRESETS[0].from,
  gradientTo: PRESETS[0].to,
  direction: "to-br",
  textColor: PRESETS[0].text,
  mutedColor: PRESETS[0].muted,
  accentColor: PRESETS[0].accent,
};

export default function BannerPage() {
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_CONFIG);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"api" | "md" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const set = useCallback(
    <K extends keyof BannerConfig>(key: K, value: BannerConfig[K]) =>
      setConfig((c) => ({ ...c, [key]: value })),
    []
  );

  const items = useMemo(() => {
    const out: string[] = [];
    if (config.showCommits) out.push("commits");
    if (config.showAdditions) out.push("additions");
    if (config.showDeletions) out.push("deletions");
    if (config.showNet) out.push("net");
    return out;
  }, [config.showCommits, config.showAdditions, config.showDeletions, config.showNet]);

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    if (config.username) params.set("username", config.username);
    params.set("range", config.range);
    if (config.title.trim()) params.set("title", config.title.trim());
    if (config.subtitle.trim()) params.set("subtitle", config.subtitle.trim());
    params.set("show_title", config.showTitle ? "1" : "0");
    params.set("show_subtitle", config.showSubtitle ? "1" : "0");
    params.set("items", items.join(","));
    params.set("top", String(config.topRepos));
    params.set("w", String(config.width));
    params.set("h", String(config.height));
    params.set("bg1", config.gradientFrom);
    params.set("bg2", config.gradientTo);
    params.set("dir", config.direction);
    params.set("text", config.textColor);
    params.set("muted", config.mutedColor);
    params.set("accent", config.accentColor);
    return `/api/banner?${params.toString()}`;
  }, [config, items]);

  const apiUrl = origin ? `${origin}${apiPath}` : apiPath;
  const previewSrc = config.username ? apiPath : "";
  const displayRange = useMemo(() => rangeDates(config.range), [config.range]);

  const mdSnippet = config.username
    ? `![GitHub stats banner](${apiUrl})`
    : `![GitHub stats banner](${origin}/api/banner?username=USERNAME)`;

  async function copy(type: "api" | "md") {
    await navigator.clipboard.writeText(type === "api" ? apiUrl : mdSnippet);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function randomPreset() {
    const p = PRESETS[Math.floor(Math.random() * PRESETS.length)];
    setConfig((c) => ({
      ...c,
      gradientFrom: p.from,
      gradientTo: p.to,
      textColor: p.text,
      mutedColor: p.muted,
      accentColor: p.accent,
    }));
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Stats
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Stats Banner Generator
              </h1>
              <p className="text-muted-foreground text-sm">
                Build an on-demand GitHub stats banner with a live API link.
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          <div className="flex flex-col gap-4">
            <Card className="gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Source
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username">GitHub username</Label>
                  <Input
                    id="username"
                    value={config.username}
                    onChange={(e) => set("username", e.target.value.trim())}
                    placeholder="torvalds"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Range</Label>
                  <Select
                    value={config.range}
                    onValueChange={(v) => set("range", v as BannerConfig["range"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RANGE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Content
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show title</Label>
                  <input
                    type="checkbox"
                    checked={config.showTitle}
                    onChange={(e) => set("showTitle", e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show subtitle</Label>
                  <input
                    type="checkbox"
                    checked={config.showSubtitle}
                    onChange={(e) => set("showSubtitle", e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={config.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder={`${config.username || "Your"} · GitHub stats`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input
                    id="subtitle"
                    value={config.subtitle}
                    onChange={(e) => set("subtitle", e.target.value)}
                    placeholder={`${rangeLabel(config.range)} · ${displayRange.from} → ${displayRange.to}`}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-sm">Stats to display</Label>
                  <label className="flex items-center justify-between text-sm">
                    Commits
                    <input
                      type="checkbox"
                      checked={config.showCommits}
                      onChange={(e) => set("showCommits", e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    Additions
                    <input
                      type="checkbox"
                      checked={config.showAdditions}
                      onChange={(e) => set("showAdditions", e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    Deletions
                    <input
                      type="checkbox"
                      checked={config.showDeletions}
                      onChange={(e) => set("showDeletions", e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    Net
                    <input
                      type="checkbox"
                      checked={config.showNet}
                      onChange={(e) => set("showNet", e.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Top repositories</Label>
                  <Select
                    value={String(config.topRepos)}
                    onValueChange={(v) => set("topRepos", Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n === 0 ? "Hide" : `Show ${n}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Colors
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    onClick={randomPreset}
                  >
                    <Shuffle className="h-3 w-3" />
                    Random
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      title={p.name}
                      onClick={() =>
                        setConfig((c) => ({
                          ...c,
                          gradientFrom: p.from,
                          gradientTo: p.to,
                          textColor: p.text,
                          mutedColor: p.muted,
                          accentColor: p.accent,
                        }))
                      }
                      className="w-7 h-7 rounded-full border-2 border-transparent hover:border-ring hover:scale-110 transition-all"
                      style={{
                        background: `linear-gradient(to bottom right, ${p.from}, ${p.to})`,
                      }}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ColorPicker
                    label="Gradient from"
                    value={config.gradientFrom}
                    onChange={(v) => set("gradientFrom", v)}
                  />
                  <ColorPicker
                    label="Gradient to"
                    value={config.gradientTo}
                    onChange={(v) => set("gradientTo", v)}
                  />
                </div>

                <ColorPicker
                  label="Text"
                  value={config.textColor}
                  onChange={(v) => set("textColor", v)}
                />
                <ColorPicker
                  label="Muted"
                  value={config.mutedColor}
                  onChange={(v) => set("mutedColor", v)}
                />
                <ColorPicker
                  label="Accent"
                  value={config.accentColor}
                  onChange={(v) => set("accentColor", v)}
                />
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Layout
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Gradient direction</Label>
                  <Select
                    value={config.direction}
                    onValueChange={(v) => set("direction", v as BannerConfig["direction"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIRECTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Width</Label>
                    <Input
                      type="number"
                      min={480}
                      max={1600}
                      value={config.width}
                      onChange={(e) => set("width", Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Height</Label>
                    <Select
                      value={String(config.height)}
                      onValueChange={(v) => set("height", Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HEIGHTS.map((h) => (
                          <SelectItem key={h.value} value={String(h.value)}>
                            {h.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card className="gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="Stats banner preview"
                    className="w-full rounded-lg border border-border"
                    style={{ display: "block" }}
                  />
                ) : (
                  <div className="h-45 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
                    Enter a GitHub username to preview
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {config.width} × {config.height} px · SVG scales to any resolution
                </p>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Export
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Button onClick={() => copy("api")} className="flex-1 gap-2" disabled={!config.username}>
                    {copied === "api" ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy API link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => copy("md")}
                    className="gap-2"
                    disabled={!config.username}
                  >
                    {copied === "md" ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy README
                  </Button>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">API link</Label>
                  <pre className="rounded-md bg-muted px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {config.username ? apiUrl : "Fill in a username to generate the API link."}
                  </pre>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">README snippet</Label>
                  <pre className="rounded-md bg-muted px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {mdSnippet}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
