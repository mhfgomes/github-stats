"use client";

import { useState } from "react";
import type { RepoStats } from "@/lib/github";
import RepoCard from "@/components/RepoCard";
import { Button } from "@/components/ui/button";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

export default function RepoList({ repos }: { repos: RepoStats[] }) {
  const [openRepos, setOpenRepos] = useState<Record<string, boolean>>({});

  const expandedCount = repos.filter((repo) => openRepos[repo.repo]).length;
  const allExpanded = repos.length > 0 && expandedCount === repos.length;

  function expandAll() {
    const next: Record<string, boolean> = {};
    for (const repo of repos) {
      next[repo.repo] = true;
    }
    setOpenRepos(next);
  }

  function collapseAll() {
    setOpenRepos({});
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Repositories ({repos.length})
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {allExpanded ? (
              <>
                <ChevronsDownUp className="h-3.5 w-3.5" />
                Collapse all
              </>
            ) : (
              <>
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Expand all
              </>
            )}
          </Button>
        </div>
      </div>
      {repos.map((repo) => (
        <RepoCard
          key={repo.repo}
          repo={repo}
          open={openRepos[repo.repo] ?? false}
          onOpenChange={(open) =>
            setOpenRepos((prev) => ({ ...prev, [repo.repo]: open }))
          }
        />
      ))}
    </div>
  );
}
