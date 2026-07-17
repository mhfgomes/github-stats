"use client";

import type { DayStats } from "@/lib/github";
import StatsDisplay from "@/components/StatsDisplay";
import StatsSkeleton from "@/components/StatsSkeleton";
import StatsError from "@/components/StatsError";
import EmptyState from "@/components/EmptyState";

export type StatsStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; stats: DayStats }
  | { type: "error"; message: string };

interface Props {
  status: StatsStatus;
  onRetry: () => void;
  onExample: (username: string) => void;
}

export default function StatsResults({ status, onRetry, onExample }: Props) {
  if (status.type === "idle") {
    return <EmptyState onExample={onExample} />;
  }

  if (status.type === "loading") {
    return <StatsSkeleton />;
  }

  if (status.type === "error") {
    return <StatsError message={status.message} onRetry={onRetry} />;
  }

  return <StatsDisplay stats={status.stats} />;
}
