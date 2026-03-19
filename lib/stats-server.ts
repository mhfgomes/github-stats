import { getDayStats, type DayStats } from "@/lib/github";

export async function resolveStats(
  username: string,
  from: string,
  to: string
): Promise<DayStats> {
  const today = new Date().toISOString().slice(0, 10);
  const resolvedFrom = from || today;
  const resolvedTo = to || resolvedFrom;
  return getDayStats(username, resolvedFrom, resolvedTo);
}
