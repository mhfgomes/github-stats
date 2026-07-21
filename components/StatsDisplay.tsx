"use client";

import type { DayStats } from "@/lib/github";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ToastProvider";
import RepoCard from "./RepoCard";
import {
  FilePlusCorner,
  FileMinusCorner,
  Activity,
  GitCommitHorizontal,
  Inbox,
  Link as LinkIcon,
} from "lucide-react";
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
    <Card className="gap-1 px-4 sm:px-6 py-4 sm:py-5" style={{ containerType: "inline-size" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium truncate">
          {label}
        </span>
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
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
  const { toast } = useToast();
  const net = stats.totalAdditions - stats.totalDeletions;

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: `Anyone opening it sees these stats for @${stats.username}.`,
      });
    } catch {
      toast({
        title: "Couldn't copy the link",
        description: "Copy the URL from the address bar instead.",
        tone: "destructive",
      });
    }
  }

  const additions = `+${stats.totalAdditions.toLocaleString("en-US")}`;
  const deletions = `-${stats.totalDeletions.toLocaleString("en-US")}`;
  const netChange = `${net >= 0 ? "+" : ""}${net.toLocaleString("en-US")}`;
  const commits = stats.totalCommits.toLocaleString("en-US");

  const maxLen = Math.max(
    additions.length,
    deletions.length,
    netChange.length,
    commits.length
  );
  const cqw = Math.min(28, Math.floor(110 / maxLen));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-muted-foreground text-sm min-w-0 truncate">
            Stats for{" "}
            <span className="text-foreground font-semibold">
              @{stats.username}
            </span>
            {" · "}
            {stats.from === stats.to ? (
              <span>{stats.from}</span>
            ) : (
              <span>
                {stats.from} → {stats.to}
              </span>
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs shrink-0"
            onClick={copyShareLink}
          >
            <LinkIcon className="h-3.5 w-3.5" aria-hidden />
            Copy link
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Additions"
            value={additions}
            cqw={cqw}
            icon={FilePlusCorner}
            className="text-emerald-700 dark:text-emerald-400"
          />
          <StatCard
            label="Deletions"
            value={deletions}
            cqw={cqw}
            icon={FileMinusCorner}
            className="text-red-700 dark:text-red-400"
          />
          <StatCard
            label="Delta"
            value={netChange}
            cqw={cqw}
            icon={Activity}
            className={
              net >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-700 dark:text-red-400"
            }
          />
          <StatCard
            label="Commits"
            value={commits}
            cqw={cqw}
            icon={GitCommitHorizontal}
            className="text-violet-700 dark:text-violet-400"
          />
        </div>
      </div>

      <Separator />

      {stats.repos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No commits in this period</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a wider date range, or confirm the username is correct.
          </p>
        </div>
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
