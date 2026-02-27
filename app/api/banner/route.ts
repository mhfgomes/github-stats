import { NextRequest, NextResponse } from "next/server";
import { resolveStats } from "@/lib/stats-server";

export const maxDuration = 300;

type Direction = "to-r" | "to-b" | "to-br" | "to-tr";
type RangeKey =
  | "today"
  | "yesterday"
  | "last7"
  | "lastweek"
  | "thismonth"
  | "lastmonth";

const DIRECTION_COORDS: Record<
  Direction,
  { x1: string; y1: string; x2: string; y2: string }
> = {
  "to-r": { x1: "0%", y1: "50%", x2: "100%", y2: "50%" },
  "to-b": { x1: "50%", y1: "0%", x2: "50%", y2: "100%" },
  "to-br": { x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
  "to-tr": { x1: "0%", y1: "100%", x2: "100%", y2: "0%" },
};

const DEFAULTS = {
  width: 900,
  height: 240,
  bg1: "#1e3c72",
  bg2: "#2a5298",
  dir: "to-br" as Direction,
  text: "#ffffff",
  muted: "#cbd5f5",
  accent: "#fbd38d",
};

const ALLOWED_ITEMS = new Set(["commits", "additions", "deletions", "net"]);

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

function parseIntParam(value: string | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return clamp(n, min, max);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function resolveRange(range: RangeKey | null, from?: string | null, to?: string | null) {
  const today = new Date();
  const todayStr = isoDate(today);

  if (!range) {
    const resolvedFrom = from ?? todayStr;
    const resolvedTo = to ?? resolvedFrom;
    return { from: resolvedFrom, to: resolvedTo };
  }

  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = new Date(start);

  if (range === "today") {
    return { from: todayStr, to: todayStr };
  }

  if (range === "yesterday") {
    start.setUTCDate(start.getUTCDate() - 1);
    const d = isoDate(start);
    return { from: d, to: d };
  }

  if (range === "last7") {
    start.setUTCDate(start.getUTCDate() - 6);
    return { from: isoDate(start), to: todayStr };
  }

  if (range === "lastweek") {
    const day = start.getUTCDay();
    const mondayOffset = (day + 6) % 7;
    start.setUTCDate(start.getUTCDate() - mondayOffset - 7);
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: isoDate(start), to: isoDate(end) };
  }

  if (range === "thismonth") {
    start.setUTCDate(1);
    return { from: isoDate(start), to: todayStr };
  }

  if (range === "lastmonth") {
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth();
    const firstOfLast = new Date(Date.UTC(year, month - 1, 1));
    const lastOfLast = new Date(Date.UTC(year, month, 0));
    return { from: isoDate(firstOfLast), to: isoDate(lastOfLast) };
  }

  return { from: todayStr, to: todayStr };
}

function formatRange(from: string, to: string) {
  return from === to ? from : `${from} → ${to}`;
}

function shorten(text: string, max = 28) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function buildSVG(opts: {
  width: number;
  height: number;
  bg1: string;
  bg2: string;
  dir: Direction;
  text: string;
  muted: string;
  accent: string;
  title: string;
  subtitle: string;
  showTitle: boolean;
  showSubtitle: boolean;
  items: string[];
  topRepos: Array<{ name: string; changes: number }>;
  stats: {
    commits: number;
    additions: number;
    deletions: number;
    net: number;
  };
}) {
  const {
    width,
    height,
    bg1,
    bg2,
    dir,
    text,
    muted,
    accent,
    title,
    subtitle,
    showTitle,
    showSubtitle,
    items,
    topRepos,
    stats,
  } = opts;

  const coords = DIRECTION_COORDS[dir];
  const pad = Math.round(height * 0.12);
  const titleSize = Math.round(height * 0.15);
  const subtitleSize = Math.round(height * 0.075);
  const valueSize = Math.round(height * 0.13);
  const labelSize = Math.round(height * 0.06);
  const repoSize = Math.round(height * 0.055);

  const statsY = showTitle || showSubtitle ? Math.round(height * 0.58) : Math.round(height * 0.48);
  const labelY = statsY + labelSize + Math.round(height * 0.03);
  const reposY = showTitle || showSubtitle ? Math.round(height * 0.78) : Math.round(height * 0.68);

  const statWidth = (width - pad * 2) / Math.max(items.length, 1);
  const statLabels: Record<string, string> = {
    commits: "Commits",
    additions: "Additions",
    deletions: "Deletions",
    net: "Net",
  };

  const formatter = new Intl.NumberFormat("en-US");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="${coords.x1}" y1="${coords.y1}" x2="${coords.x2}" y2="${coords.y2}">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.3" fill="${text}" opacity="0.10"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" rx="${Math.round(height * 0.08)}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" rx="${Math.round(height * 0.08)}" fill="url(#dots)"/>
  ${showTitle ? `<text x="${pad}" y="${pad + titleSize}" fill="${text}" font-size="${titleSize}" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${escapeXml(title)}</text>` : ""}
  ${showSubtitle ? `<text x="${pad}" y="${pad + titleSize + subtitleSize + Math.round(height * 0.02)}" fill="${muted}" font-size="${subtitleSize}" font-weight="500" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${escapeXml(subtitle)}</text>` : ""}
  ${items
    .map((key, i) => {
      const x = pad + statWidth * i + statWidth / 2;
      const value = formatter.format(stats[key as keyof typeof stats]);
      const label = statLabels[key] ?? key;
      return `
  <text x="${x}" y="${statsY}" text-anchor="middle" dominant-baseline="middle" fill="${text}" font-size="${valueSize}" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${value}</text>
  <text x="${x}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" fill="${muted}" font-size="${labelSize}" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" letter-spacing="0.5">${label.toUpperCase()}</text>`;
    })
    .join("")}
  ${topRepos
    .map((r, i) => {
      const y = reposY + i * Math.round(height * 0.08);
      return `
  <text x="${pad}" y="${y}" fill="${accent}" font-size="${repoSize}" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">#${i + 1}</text>
  <text x="${pad + Math.round(height * 0.06)}" y="${y}" fill="${text}" font-size="${repoSize}" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${escapeXml(shorten(r.name))}</text>
  <text x="${width - pad}" y="${y}" text-anchor="end" fill="${muted}" font-size="${repoSize}" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif">${formatter.format(r.changes)}</text>`;
    })
    .join("")}
</svg>`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const username = searchParams.get("username")?.trim();

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const range = searchParams.get("range") as RangeKey | null;
  const resolved = resolveRange(range, searchParams.get("from"), searchParams.get("to"));
  const from = resolved.from;
  const to = resolved.to;

  const width = parseIntParam(searchParams.get("w"), DEFAULTS.width, 480, 1600);
  const height = parseIntParam(searchParams.get("h"), DEFAULTS.height, 160, 520);

  const bg1 = searchParams.get("bg1") ?? DEFAULTS.bg1;
  const bg2 = searchParams.get("bg2") ?? DEFAULTS.bg2;
  const dirParam = searchParams.get("dir") as Direction | null;
  const dir = dirParam && dirParam in DIRECTION_COORDS ? dirParam : DEFAULTS.dir;
  const text = searchParams.get("text") ?? DEFAULTS.text;
  const muted = searchParams.get("muted") ?? DEFAULTS.muted;
  const accent = searchParams.get("accent") ?? DEFAULTS.accent;

  const showTitle = searchParams.get("show_title") !== "0";
  const showSubtitle = searchParams.get("show_subtitle") !== "0";
  const title =
    searchParams.get("title")?.trim() || `${username} · GitHub stats`;
  const subtitle =
    searchParams.get("subtitle")?.trim() || formatRange(from, to);

  const rawItems = (searchParams.get("items") ?? "commits,additions,deletions")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ALLOWED_ITEMS.has(s));
  const items = rawItems.length > 0 ? rawItems : ["commits"];

  const top = parseIntParam(searchParams.get("top"), 3, 0, 6);

  try {
    const stats = await resolveStats(username, from, to);
    const net = stats.totalAdditions - stats.totalDeletions;
    const topRepos = stats.repos
      .slice(0, top)
      .map((r) => ({ name: r.repo, changes: r.additions + r.deletions }));

    const svg = buildSVG({
      width,
      height,
      bg1,
      bg2,
      dir,
      text,
      muted,
      accent,
      title,
      subtitle,
      showTitle,
      showSubtitle,
      items,
      topRepos,
      stats: {
        commits: stats.totalCommits,
        additions: stats.totalAdditions,
        deletions: stats.totalDeletions,
        net,
      },
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
