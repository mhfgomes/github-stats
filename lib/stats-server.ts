import {
  getDayStats,
  fetchRawCommits,
  aggregateCommits,
  type CommitStats,
  type DayStats,
} from "@/lib/github";

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export async function resolveStats(
  username: string,
  from: string,
  to: string
): Promise<DayStats> {
  const today = new Date().toISOString().slice(0, 10);
  const resolvedFrom = from || today;
  const resolvedTo = to || resolvedFrom;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return getDayStats(username, resolvedFrom, resolvedTo);
  }

  const { ConvexHttpClient } = await import("convex/browser");
  const { api } = await import("@/convex/_generated/api");
  const convex = new ConvexHttpClient(convexUrl);

  const days = eachDay(resolvedFrom, resolvedTo);
  const pastDays = days.filter((d) => d < today);
  const includesToday = days.includes(today);

  const cachedResults = await Promise.all(
    pastDays.map(async (date) => {
      const row = await convex.query(api.stats.getByDate, { username, date });
      return { date, row };
    })
  );

  const cachedCommits: CommitStats[] = [];
  const uncachedPastDays: string[] = [];

  for (const { date, row } of cachedResults) {
    if (row) {
      cachedCommits.push(...(row.commits as CommitStats[]));
    } else {
      uncachedPastDays.push(date);
    }
  }

  const uncachedDates = [...uncachedPastDays, ...(includesToday ? [today] : [])];

  let freshCommits: CommitStats[] = [];
  if (uncachedDates.length > 0) {
    const githubFrom = uncachedDates[0];
    const githubTo = uncachedDates[uncachedDates.length - 1];
    freshCommits = await fetchRawCommits(username, githubFrom, githubTo);

    const byDay = new Map<string, CommitStats[]>();
    for (const c of freshCommits) {
      const day = c.date.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(c);
    }

    await Promise.all(
      uncachedPastDays.map((date) =>
        convex.mutation(api.stats.setDay, {
          username,
          date,
          commits: byDay.get(date) ?? [],
        })
      )
    );
  }

  const uncachedSet = new Set(uncachedDates);
  const allCommits = [
    ...cachedCommits,
    ...freshCommits.filter((c) => uncachedSet.has(c.date.slice(0, 10))),
  ];

  return aggregateCommits(username, resolvedFrom, resolvedTo, allCommits);
}
