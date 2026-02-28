import { NextRequest, NextResponse } from "next/server";

type Direction = "to-r" | "to-b" | "to-br" | "to-tr";

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
  height: 300,
  bg1: "#1e3c72",
  bg2: "#2a5298",
  dir: "to-br" as Direction,
  text: "#ffffff",
  muted: "#cbd5f5",
  top: 8,
};

// GitHub linguist colors
const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Java: "#b07219",
  "C#": "#178600",
  "C++": "#f34b7d",
  C: "#555555",
  PHP: "#4F5D95",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Ruby: "#701516",
  Go: "#00ADD8",
  Rust: "#dea584",
  Swift: "#ffac45",
  Kotlin: "#A97BFF",
  Vue: "#41b883",
  Shell: "#89e051",
  Dart: "#00B4AB",
  Handlebars: "#f7931e",
  Scala: "#c22d40",
  Lua: "#000080",
  Perl: "#0298c3",
  Haskell: "#5e5086",
  R: "#198CE7",
  MATLAB: "#e16737",
  Groovy: "#e69f56",
  PowerShell: "#012456",
  Elixir: "#6e4a7e",
  Clojure: "#db5855",
  CoffeeScript: "#244776",
  "Objective-C": "#438eff",
  SCSS: "#c6538c",
  Less: "#1d365d",
  Makefile: "#427819",
  Dockerfile: "#384d54",
  Svelte: "#ff3e00",
  "Jupyter Notebook": "#DA5B0B",
};

const FALLBACK_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#84cc16",
];

function getLangColor(lang: string, index: number): string {
  return LANG_COLORS[lang] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function parseIntParam(
  v: string | null,
  fallback: number,
  min: number,
  max: number
) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return clamp(n, min, max);
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function headers() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchLanguageBytes(
  username: string
): Promise<Map<string, number>> {
  const token = process.env.GITHUB_TOKEN;

  // Check if the requested username owns the token — if so use authenticated
  // endpoint to include private repos, otherwise fall back to public API.
  let isTokenOwner = false;
  if (token) {
    const meRes = await fetch("https://api.github.com/user", { headers: headers() });
    if (meRes.ok) {
      const me: { login: string } = await meRes.json();
      isTokenOwner = me.login.toLowerCase() === username.toLowerCase();
    }
  }

  const allRepos: { full_name: string; fork: boolean }[] = [];
  for (let page = 1; page <= 5; page++) {
    const url = isTokenOwner
      ? `https://api.github.com/user/repos?visibility=all&affiliation=owner&per_page=100&page=${page}&sort=pushed`
      : `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=pushed`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
    const data: { full_name: string; fork: boolean }[] = await res.json();
    allRepos.push(...data);
    if (data.length < 100) break;
  }

  // Exclude forked repos — they skew results with languages you didn't write
  const ownRepos = allRepos.filter((r) => !r.fork);
  const reposToCheck = ownRepos.slice(0, 50);
  const langTotals = new Map<string, number>();

  const BATCH = 20;
  for (let i = 0; i < reposToCheck.length; i += BATCH) {
    const batch = reposToCheck.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (repo) => {
        const res = await fetch(
          `https://api.github.com/repos/${repo.full_name}/languages`,
          { headers: headers() }
        );
        if (!res.ok) return {} as Record<string, number>;
        return res.json() as Promise<Record<string, number>>;
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        for (const [lang, bytes] of Object.entries(r.value)) {
          langTotals.set(lang, (langTotals.get(lang) ?? 0) + bytes);
        }
      }
    }
  }

  return langTotals;
}

function buildSVG(opts: {
  width: number;
  height: number;
  bg1: string;
  bg2: string;
  dir: Direction;
  text: string;
  muted: string;
  title: string;
  languages: Array<{ name: string; pct: number; color: string }>;
}) {
  const { width, height, bg1, bg2, dir, text, muted, title, languages } = opts;
  const coords = DIRECTION_COORDS[dir];

  const pad = Math.round(height * 0.11);
  const titleSize = Math.round(height * 0.13);
  const langSize = Math.round(height * 0.065);
  const dotR = Math.round(height * 0.026);
  const barH = Math.round(height * 0.038);
  const rx = Math.round(height * 0.07);

  const titleY = pad + titleSize;
  const barY = titleY + Math.round(height * 0.09);
  const listY = barY + barH + Math.round(height * 0.085);

  const barW = width - pad * 2;
  const colW = Math.floor(barW / 2);

  const perCol = Math.ceil(languages.length / 2);
  const availableH = height - listY - pad;
  const rowH = perCol > 0 ? Math.floor(availableH / perCol) : 30;

  // Build bar segments (last segment fills remaining to avoid rounding gaps)
  const segments: Array<{ x: number; w: number; color: string }> = [];
  let barX = pad;
  for (let i = 0; i < languages.length; i++) {
    const lang = languages[i];
    const isLast = i === languages.length - 1;
    const segW = isLast
      ? pad + barW - barX
      : Math.round((lang.pct / 100) * barW);
    segments.push({ x: barX, w: Math.max(segW, 0), color: lang.color });
    barX += segW;
  }

  const font = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="${coords.x1}" y1="${coords.y1}" x2="${coords.x2}" y2="${coords.y2}">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.3" fill="${text}" opacity="0.10"/>
    </pattern>
    <clipPath id="barClip">
      <rect x="${pad}" y="${barY}" width="${barW}" height="${barH}" rx="${Math.round(barH / 2)}"/>
    </clipPath>
  </defs>
  <rect width="${width}" height="${height}" rx="${rx}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" rx="${rx}" fill="url(#dots)"/>
  <text x="${pad}" y="${titleY}" fill="${text}" font-size="${titleSize}" font-weight="700" font-family="${font}">${escapeXml(title)}</text>
  <rect x="${pad}" y="${barY}" width="${barW}" height="${barH}" rx="${Math.round(barH / 2)}" fill="${text}" opacity="0.15"/>
  <g clip-path="url(#barClip)">
    ${segments
      .map(
        (s) =>
          `<rect x="${s.x}" y="${barY}" width="${s.w}" height="${barH}" fill="${s.color}"/>`
      )
      .join("\n    ")}
  </g>
  ${languages.length === 0
    ? `<text x="${width / 2}" y="${listY + Math.round((height - listY - pad) / 2)}" text-anchor="middle" dominant-baseline="central" fill="${muted}" font-size="${langSize}" font-weight="500" font-family="${font}" opacity="0.6">No language data available</text>`
    : languages
        .map((lang, i) => {
          const col = i >= perCol ? 1 : 0;
          const row = i % perCol;
          const colOffsetX = pad + col * colW;
          const cx = colOffsetX + dotR;
          const cy = listY + row * rowH + Math.floor(rowH / 2);
          const nameX = cx + dotR + Math.round(height * 0.018);
          const pctX = pad + (col + 1) * colW - 4;
          return `
  <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${lang.color}"/>
  <text x="${nameX}" y="${cy}" dominant-baseline="central" fill="${text}" font-size="${langSize}" font-weight="600" font-family="${font}">${escapeXml(lang.name)}</text>
  <text x="${pctX}" y="${cy}" text-anchor="end" dominant-baseline="central" fill="${muted}" font-size="${langSize}" font-weight="500" font-family="${font}">${lang.pct.toFixed(2)}%</text>`;
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

  const width = parseIntParam(searchParams.get("w"), DEFAULTS.width, 480, 1600);
  const height = parseIntParam(
    searchParams.get("h"),
    DEFAULTS.height,
    160,
    520
  );
  const bg1 = searchParams.get("bg1") ?? DEFAULTS.bg1;
  const bg2 = searchParams.get("bg2") ?? DEFAULTS.bg2;
  const dirParam = searchParams.get("dir") as Direction | null;
  const dir =
    dirParam && dirParam in DIRECTION_COORDS ? dirParam : DEFAULTS.dir;
  const text = searchParams.get("text") ?? DEFAULTS.text;
  const muted = searchParams.get("muted") ?? DEFAULTS.muted;
  const top = parseIntParam(searchParams.get("top"), DEFAULTS.top, 1, 12);
  const title =
    searchParams.get("title")?.trim() || "Most Used Languages";

  try {
    const langBytes = await fetchLanguageBytes(username);
    const sorted = [...langBytes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, top);

    if (sorted.length === 0) {
      const emptySvg = buildSVG({ width, height, bg1, bg2, dir, text, muted, title, languages: [] });
      return new NextResponse(emptySvg, {
        status: 200,
        headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
      });
    }

    const topTotal = sorted.reduce((s, [, v]) => s + v, 0);
    const languages = sorted.map(([name, bytes], i) => ({
      name,
      pct: (bytes / topTotal) * 100,
      color: getLangColor(name, i),
    }));

    const svg = buildSVG({
      width,
      height,
      bg1,
      bg2,
      dir,
      text,
      muted,
      title,
      languages,
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
