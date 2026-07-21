"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Shuffle } from "lucide-react";
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
import ToggleRow from "@/components/ToggleRow";
import ColorPicker from "@/components/banner/ColorPicker";
import ThemePresets from "@/components/banner/ThemePresets";
import BannerExport from "@/components/banner/BannerExport";
import {
  BANNER_DIRECTIONS,
  BANNER_THEME_PRESETS,
  DEFAULT_BANNER_THEME,
  type BannerDirection,
} from "@/lib/banner-presets";
import dynamic from "next/dynamic";

const ThemeToggle = dynamic(
  () => import("@/components/ThemeToggle").then((m) => m.ThemeToggle),
  { ssr: false }
);

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
  direction: BannerDirection;
  textColor: string;
  mutedColor: string;
  accentColor: string;
}

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
  gradientFrom: DEFAULT_BANNER_THEME.from,
  gradientTo: DEFAULT_BANNER_THEME.to,
  direction: "to-br",
  textColor: DEFAULT_BANNER_THEME.text,
  mutedColor: DEFAULT_BANNER_THEME.muted,
  accentColor: DEFAULT_BANNER_THEME.accent,
};

export default function StatsBannerPage() {
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_CONFIG);
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");

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

  function applyPreset(p: (typeof BANNER_THEME_PRESETS)[number]) {
    setConfig((c) => ({
      ...c,
      gradientFrom: p.from,
      gradientTo: p.to,
      textColor: p.text,
      mutedColor: p.muted,
      accentColor: p.accent,
    }));
  }

  function randomPreset() {
    applyPreset(
      BANNER_THEME_PRESETS[Math.floor(Math.random() * BANNER_THEME_PRESETS.length)]
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-start sm:items-center justify-between gap-3 mb-8">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href="/banner">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Banners</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Stats Banner
              </h1>
              <p className="text-muted-foreground text-sm">
                Commits, additions &amp; deletions for any date range.
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          <div className="flex flex-col gap-4 order-2 lg:order-1">
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
                  <Label htmlFor="range">Range</Label>
                  <Select
                    value={config.range}
                    onValueChange={(v) => set("range", v as BannerConfig["range"])}
                  >
                    <SelectTrigger id="range">
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
                <ToggleRow
                  label="Show title"
                  checked={config.showTitle}
                  onChange={(v) => set("showTitle", v)}
                />
                <ToggleRow
                  label="Show subtitle"
                  checked={config.showSubtitle}
                  onChange={(v) => set("showSubtitle", v)}
                />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={config.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder={`${config.username || "Your"} · GitHub stats`}
                    disabled={!config.showTitle}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input
                    id="subtitle"
                    value={config.subtitle}
                    onChange={(e) => set("subtitle", e.target.value)}
                    placeholder={`${rangeLabel(config.range)} · ${displayRange.from} → ${displayRange.to}`}
                    disabled={!config.showSubtitle}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <Label className="text-sm">Stats to display</Label>
                  <ToggleRow
                    label="Commits"
                    checked={config.showCommits}
                    onChange={(v) => set("showCommits", v)}
                  />
                  <ToggleRow
                    label="Additions"
                    checked={config.showAdditions}
                    onChange={(v) => set("showAdditions", v)}
                  />
                  <ToggleRow
                    label="Deletions"
                    checked={config.showDeletions}
                    onChange={(v) => set("showDeletions", v)}
                  />
                  <ToggleRow
                    label="Net"
                    checked={config.showNet}
                    onChange={(v) => set("showNet", v)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="top-repos">Top repositories</Label>
                  <Select
                    value={String(config.topRepos)}
                    onValueChange={(v) => set("topRepos", Number(v))}
                  >
                    <SelectTrigger id="top-repos">
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
                <ThemePresets
                  selected={{
                    from: config.gradientFrom,
                    to: config.gradientTo,
                    text: config.textColor,
                    muted: config.mutedColor,
                    accent: config.accentColor,
                  }}
                  onSelect={applyPreset}
                />

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
                  <Label htmlFor="direction">Gradient direction</Label>
                  <Select
                    value={config.direction}
                    onValueChange={(v) => set("direction", v as BannerDirection)}
                  >
                    <SelectTrigger id="direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BANNER_DIRECTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="width">Width</Label>
                    <Input
                      id="width"
                      type="number"
                      min={480}
                      max={1600}
                      value={config.width}
                      onChange={(e) => set("width", Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="height">Height</Label>
                    <Select
                      value={String(config.height)}
                      onValueChange={(v) => set("height", Number(v))}
                    >
                      <SelectTrigger id="height">
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

          <div className="flex flex-col gap-4 order-1 lg:order-2 lg:sticky lg:top-6">
            <Card className="gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {previewSrc ? (
                  <Image
                    src={previewSrc}
                    alt="Stats banner preview"
                    width={config.width}
                    height={config.height}
                    className="w-full rounded-lg border border-border"
                    unoptimized
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

            <BannerExport
              apiUrl={apiUrl}
              mdSnippet={mdSnippet}
              enabled={Boolean(config.username)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
