import type { DayStats } from "@/lib/github";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import RepoCard from "./RepoCard";
import { FilePlusCorner, FileMinusCorner, Activity, GitCommitHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function StatCard({
  label,
  value,
  cqw,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  cqw: number;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Card className="gap-1 px-6 py-5" style={{ containerType: "inline-size" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <span
        className={`font-bold font-mono leading-tight ${className}`}
        style={{ fontSize: `clamp(0.875rem, ${cqw}cqw, 1.875rem)` }}
      >
        {value}
      </span>
    </Card>
  );
}

export default function StatsDisplay({ stats }: { stats: DayStats }) {
  const net = stats.totalAdditions - stats.totalDeletions;

  const additions = `+${stats.totalAdditions.toLocaleString("en-US")}`;
  const deletions = `-${stats.totalDeletions.toLocaleString("en-US")}`;
  const netChange = `${net >= 0 ? "+" : ""}${net.toLocaleString("en-US")}`;
  const commits = stats.totalCommits.toLocaleString("en-US");

  const maxLen = Math.max(additions.length, deletions.length, netChange.length, commits.length);
  const cqw = Math.min(28, Math.floor(110 / maxLen));

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
          <StatCard label="Additions" value={additions} cqw={cqw} icon={FilePlusCorner} className="text-emerald-400" />
          <StatCard label="Deletions" value={deletions} cqw={cqw} icon={FileMinusCorner} className="text-red-400" />
          <StatCard
            label="Net change"
            value={netChange}
            cqw={cqw}
            icon={Activity}
            className={net >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <StatCard label="Commits" value={commits} cqw={cqw} icon={GitCommitHorizontal} className="text-violet-400" />
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
