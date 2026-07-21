"use client";

import { useMemo, useState } from "react";
import type { RepoStats } from "@/lib/github";
import RepoCard from "@/components/RepoCard";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortKey = "commits" | "additions" | "deletions" | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "commits", label: "Most commits" },
  { value: "additions", label: "Most additions" },
  { value: "deletions", label: "Most deletions" },
  { value: "name", label: "Name (A–Z)" },
];

function sortRepos(repos: RepoStats[], sortBy: SortKey) {
  const sorted = [...repos];
  sorted.sort((a, b) => {
    if (sortBy === "name") {
      return a.repo.localeCompare(b.repo);
    }
    if (sortBy === "commits") {
      return b.commitCount - a.commitCount;
    }
    if (sortBy === "additions") {
      return b.additions - a.additions;
    }
    return b.deletions - a.deletions;
  });
  return sorted;
}

export default function RepoList({ repos }: { repos: RepoStats[] }) {
  const [sortBy, setSortBy] = useState<SortKey>("commits");
  const sortedRepos = useMemo(() => sortRepos(repos, sortBy), [repos, sortBy]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Repositories ({repos.length})
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="repo-sort" className="text-xs text-muted-foreground sr-only">
            Sort repositories
          </Label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
            <SelectTrigger id="repo-sort" size="sm" className="h-7 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {sortedRepos.map((repo) => (
        <RepoCard key={repo.repo} repo={repo} />
      ))}
    </div>
  );
}
