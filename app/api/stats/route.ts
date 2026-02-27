import { NextRequest, NextResponse } from "next/server";
import { resolveStats } from "@/lib/stats-server";

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

  try {
    const stats = await resolveStats(username, resolvedFrom, resolvedTo);
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
