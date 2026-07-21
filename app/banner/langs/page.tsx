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

interface LangsConfig {
  username: string;
  topLangs: number;
  width: number;
  height: number;
  gradientFrom: string;
  gradientTo: string;
  direction: BannerDirection;
  textColor: string;
  mutedColor: string;
}

const HEIGHTS = [
  { value: 240, label: "Compact  (240 px)" },
  { value: 300, label: "Medium   (300 px)" },
  { value: 380, label: "Tall     (380 px)" },
  { value: 460, label: "Hero     (460 px)" },
];

const DEFAULT_CONFIG: LangsConfig = {
  username: "",
  topLangs: 6,
  width: 900,
  height: 300,
  gradientFrom: DEFAULT_BANNER_THEME.from,
  gradientTo: DEFAULT_BANNER_THEME.to,
  direction: "to-br",
  textColor: DEFAULT_BANNER_THEME.text,
  mutedColor: DEFAULT_BANNER_THEME.muted,
};

export default function LangsBannerPage() {
  const [config, setConfig] = useState<LangsConfig>(DEFAULT_CONFIG);
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");

  const set = useCallback(
    <K extends keyof LangsConfig>(key: K, value: LangsConfig[K]) =>
      setConfig((c) => ({ ...c, [key]: value })),
    []
  );

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    if (config.username) params.set("username", config.username);
    params.set("top", String(config.topLangs));
    params.set("w", String(config.width));
    params.set("h", String(config.height));
    params.set("bg1", config.gradientFrom);
    params.set("bg2", config.gradientTo);
    params.set("dir", config.direction);
    params.set("text", config.textColor);
    params.set("muted", config.mutedColor);
    return `/api/languages-banner?${params.toString()}`;
  }, [config]);

  const apiUrl = origin ? `${origin}${apiPath}` : apiPath;
  const previewSrc = config.username ? apiPath : "";

  const mdSnippet = config.username
    ? `![Most Used Languages](${apiUrl})`
    : `![Most Used Languages](${origin}/api/languages-banner?username=USERNAME)`;

  function applyPreset(p: (typeof BANNER_THEME_PRESETS)[number]) {
    setConfig((c) => ({
      ...c,
      gradientFrom: p.from,
      gradientTo: p.to,
      textColor: p.text,
      mutedColor: p.muted,
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
                Languages Banner
              </h1>
              <p className="text-muted-foreground text-sm">
                Most used languages across all your repositories, all time.
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
                  <Label htmlFor="top-langs">Top languages</Label>
                  <Select
                    value={String(config.topLangs)}
                    onValueChange={(v) => set("topLangs", Number(v))}
                  >
                    <SelectTrigger id="top-langs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[4, 5, 6, 7, 8, 10, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Top {n}
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
                    accent: "",
                  }}
                  onSelect={applyPreset}
                  matchAccent={false}
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
                    alt="Languages banner preview"
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
                  {config.width} × {config.height} px · Own repos only, forks excluded · SVG scales to any resolution
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
