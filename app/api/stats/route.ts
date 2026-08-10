import { NextRequest, NextResponse } from "next/server";
import { resolveStats } from "@/lib/stats-server";
import { getTtlCacheValue, setTtlCacheValue } from "@/lib/ttl-cache";
import type { DayStats } from "@/lib/github";

const STATS_CACHE_TTL_MS = 60_000;
const STATS_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=30";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const username = searchParams.get("username")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const resolvedFrom = from ?? today;
  const resolvedTo = to ?? resolvedFrom;
  const cacheKey = `${username.toLowerCase()}|${resolvedFrom}|${resolvedTo}`;

  const cached = getTtlCacheValue<DayStats>("day-stats", cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": STATS_CACHE_CONTROL },
    });
  }

  try {
    const stats = await resolveStats(username, resolvedFrom, resolvedTo);
    setTtlCacheValue("day-stats", cacheKey, stats, STATS_CACHE_TTL_MS);
    return NextResponse.json(stats, {
      headers: { "Cache-Control": STATS_CACHE_CONTROL },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
