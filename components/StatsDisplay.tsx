import type { DayStats } from "@/lib/github";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import RepoCard from "./RepoCard";

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card className="gap-1 px-6 py-5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </span>
      <span className={`text-3xl font-bold font-mono ${className}`}>{value}</span>
    </Card>
  );
}

export default function StatsDisplay({ stats }: { stats: DayStats }) {
  const net = stats.totalAdditions - stats.totalDeletions;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground text-sm mb-4">
          Stats for{" "}
          <span className="text-foreground font-semibold">@{stats.username}</span>
          {" · "}
          {stats.from === stats.to ? (
            <span>{stats.from}</span>
          ) : (
            <span>
              {stats.from} → {stats.to}
            </span>
          )}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Additions"
            value={`+${stats.totalAdditions.toLocaleString()}`}
            className="text-emerald-400"
          />
          <StatCard
            label="Deletions"
            value={`-${stats.totalDeletions.toLocaleString()}`}
            className="text-red-400"
          />
          <StatCard
            label="Net change"
            value={`${net >= 0 ? "+" : ""}${net.toLocaleString()}`}
            className={net >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <StatCard
            label="Commits"
            value={stats.totalCommits.toLocaleString()}
            className="text-violet-400"
          />
        </div>
      </div>

      <Separator />

      {stats.repos.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No commits found for this period.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Repositories ({stats.repos.length})
          </p>
          {stats.repos.map((r) => (
            <RepoCard key={r.repo} repo={r} />
          ))}
        </div>
      )}
    </div>
  );
}
