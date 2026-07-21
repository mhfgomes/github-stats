"use client";

import { useState } from "react";
import type { RepoStats } from "@/lib/github";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ExternalLink, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

function privateRepoLabel(repo: string) {
  const id = repo.startsWith("private:") ? repo.slice("private:".length) : repo;
  return `Private repository · ${id}`;
}

export default function RepoCard({ repo }: { repo: RepoStats }) {
  const [open, setOpen] = useState(false);
  const isPrivateRepo = repo.isPrivate;
  const title = isPrivateRepo ? privateRepoLabel(repo.repo) : repo.repo;
  const repoLink = !isPrivateRepo ? repo.repoUrl : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="gap-0 py-0 overflow-hidden">
        <div className="flex items-stretch">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex-1 min-w-0 flex items-center justify-between pl-4 sm:pl-5 py-4 hover:bg-accent/40 transition-colors text-left",
              repoLink ? "pr-2" : "pr-4 sm:pr-5"
            )}
            aria-expanded={open}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {isPrivateRepo && (
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    aria-hidden
                  >
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="text-sm font-medium truncate block">{title}</span>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {repo.commitCount} commit{repo.commitCount !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 shrink-0 ml-3 sm:ml-4">
              <span className="text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                +{repo.additions.toLocaleString("en-US")}
              </span>
              <span className="text-sm font-mono font-semibold text-red-700 dark:text-red-400">
                -{repo.deletions.toLocaleString("en-US")}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </div>
          </button>
        </CollapsibleTrigger>
        {repoLink && (
          <a
            href={repoLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${repo.repo} on GitHub`}
            title="Open on GitHub"
            className="flex items-center px-3 sm:px-4 text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
        </div>

        <CollapsibleContent>
          <Separator />
          <div className="divide-y divide-border/60">
            {repo.commits.map((c, index) => (
              <div
                key={`${repo.repo}-${c.sha}-${c.date}-${index}`}
                className="flex items-start justify-between px-5 py-3 gap-4"
              >
                <div className="min-w-0 flex-1">
                  {c.commitUrl ? (
                    <a
                      href={c.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-violet-700 dark:hover:text-violet-400 transition-colors truncate block"
                    >
                      {c.message}
                    </a>
                  ) : c.isPrivate ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5 text-amber-700/80 dark:text-amber-300/80" aria-hidden />
                      <span className="truncate">
                        Commit details hidden for private repository
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground truncate block">
                      {c.message}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/70 font-mono">
                    {c.isPrivate ? "SHA hidden" : c.sha.slice(0, 7)}
                  </span>
                </div>
                <div className="flex gap-3 shrink-0 text-sm font-mono">
                  <span className="text-emerald-700 dark:text-emerald-400">
                    +{c.additions.toLocaleString("en-US")}
                  </span>
                  <span className="text-red-700 dark:text-red-400">
                    -{c.deletions.toLocaleString("en-US")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
