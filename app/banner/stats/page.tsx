"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import dynamic from "next/dynamic";
import {
  BANNER_DIRECTIONS,
  BANNER_PRESETS,
  ColorPicker,
  PresetSwatches,
  useDebouncedValue,
} from "@/components/banner/shared";

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
  direction: "to-r" | "to-b" | "to-br" | "to-tr";
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
  gradientFrom: BANNER_PRESETS[0].from,
  gradientTo: BANNER_PRESETS[0].to,
  direction: "to-br",
  textColor: BANNER_PRESETS[0].text,
  mutedColor: BANNER_PRESETS[0].muted,
  accentColor: BANNER_PRESETS[0].accent ?? "#D97757",
};

function buildBannerPath(config: BannerConfig, username: string) {
  const items: string[] = [];
  if (config.showCommits) items.push("commits");
  if (config.showAdditions) items.push("additions");
  if (config.showDeletions) items.push("deletions");
  if (config.showNet) items.push("net");

  const params = new URLSearchParams();
  if (username) params.set("username", username);
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
}

function ToggleRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function StatsBannerPage() {
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_CONFIG);
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const [copied, setCopied] = useState<"api" | "md" | null>(null);
  const debouncedUsername = useDebouncedValue(config.username.trim(), 400);

  const set = useCallback(
    <K extends keyof BannerConfig>(key: K, value: BannerConfig[K]) =>
      setConfig((c) => ({ ...c, [key]: value })),
    []
  );

  const trimmedUsername = config.username.trim();
  const apiPath = useMemo(
    () => buildBannerPath(config, trimmedUsername),
    [config, trimmedUsername]
  );
  const previewPath = useMemo(
    () => (debouncedUsername ? buildBannerPath(config, debouncedUsername) : ""),
    [config, debouncedUsername]
  );

  const apiUrl = origin ? `${origin}${apiPath}` : apiPath;
  const displayRange = useMemo(() => rangeDates(config.range), [config.range]);
  const previewPending =
    Boolean(trimmedUsername) && trimmedUsername !== debouncedUsername;

  const mdSnippet = trimmedUsername
    ? `![GitHub stats banner](${apiUrl})`
    : `![GitHub stats banner](${origin}/api/banner?username=USERNAME)`;

  async function copy(type: "api" | "md") {
    await navigator.clipboard.writeText(type === "api" ? apiUrl : mdSnippet);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function randomPreset() {
    const p = BANNER_PRESETS[Math.floor(Math.random() * BANNER_PRESETS.length)];
    setConfig((c) => ({
      ...c,
      gradientFrom: p.from,
      gradientTo: p.to,
      textColor: p.text,
      mutedColor: p.muted,
      accentColor: p.accent ?? c.accentColor,
    }));
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/banner">
                <ArrowLeft className="h-4 w-4" />
                Banners
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Stats Banner</h1>
              <p className="text-muted-foreground text-sm truncate">
                Commits, additions &amp; deletions for any date range.
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          <div className="order-2 lg:order-1 flex flex-col gap-4">
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
                    onChange={(e) => set("username", e.target.value)}
                    placeholder="torvalds"
                    autoComplete="username"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Range</Label>
                  <Select
                    value={config.range}
                    onValueChange={(v) => set("range", v as BannerConfig["range"])}
                  >
                    <SelectTrigger className="w-full">
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
                  id="show-title"
                  label="Show title"
                  checked={config.showTitle}
                  onCheckedChange={(v) => set("showTitle", v)}
                />
                <ToggleRow
                  id="show-subtitle"
                  label="Show subtitle"
                  checked={config.showSubtitle}
                  onCheckedChange={(v) => set("showSubtitle", v)}
                />
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

                <div className="flex flex-col gap-3">
                  <Label className="text-sm">Stats to display</Label>
                  <ToggleRow
                    id="show-commits"
                    label="Commits"
                    checked={config.showCommits}
                    onCheckedChange={(v) => set("showCommits", v)}
                  />
                  <ToggleRow
                    id="show-additions"
                    label="Additions"
                    checked={config.showAdditions}
                    onCheckedChange={(v) => set("showAdditions", v)}
                  />
                  <ToggleRow
                    id="show-deletions"
                    label="Deletions"
                    checked={config.showDeletions}
                    onCheckedChange={(v) => set("showDeletions", v)}
                  />
                  <ToggleRow
                    id="show-net"
                    label="Net"
                    checked={config.showNet}
                    onCheckedChange={(v) => set("showNet", v)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Top repositories</Label>
                  <Select
                    value={String(config.topRepos)}
                    onValueChange={(v) => set("topRepos", Number(v))}
                  >
                    <SelectTrigger className="w-full">
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
                <PresetSwatches
                  presets={BANNER_PRESETS}
                  current={{
                    from: config.gradientFrom,
                    to: config.gradientTo,
                    text: config.textColor,
                    muted: config.mutedColor,
                    accent: config.accentColor,
                  }}
                  onSelect={(p) =>
                    setConfig((c) => ({
                      ...c,
                      gradientFrom: p.from,
                      gradientTo: p.to,
                      textColor: p.text,
                      mutedColor: p.muted,
                      accentColor: p.accent ?? c.accentColor,
                    }))
                  }
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
                  <Label>Gradient direction</Label>
                  <Select
                    value={config.direction}
                    onValueChange={(v) => set("direction", v as BannerConfig["direction"])}
                  >
                    <SelectTrigger className="w-full">
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
                      <SelectTrigger className="w-full">
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

          <div className="order-1 lg:order-2 flex flex-col gap-4 lg:sticky lg:top-4">
            <Card className="gap-0 py-0">
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {previewPath ? (
                  <div className="relative">
                    <Image
                      key={previewPath}
                      src={previewPath}
                      alt="Stats banner preview"
                      width={config.width}
                      height={config.height}
                      className={`w-full rounded-lg border border-border transition-opacity ${
                        previewPending ? "opacity-60" : "opacity-100"
                      }`}
                      unoptimized
                    />
                    {previewPending ? (
                      <p className="absolute inset-x-0 bottom-2 text-center text-xs text-muted-foreground">
                        Updating preview…
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="h-45 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Button
                    onClick={() => copy("api")}
                    className="flex-1 gap-2"
                    disabled={!trimmedUsername}
                  >
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
                    disabled={!trimmedUsername}
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
                    {trimmedUsername
                      ? apiUrl
                      : "Fill in a username to generate the API link."}
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
