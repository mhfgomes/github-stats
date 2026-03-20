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
import { ChevronDown, Lock } from "lucide-react";

export default function RepoCard({ repo }: { repo: RepoStats }) {
  const [open, setOpen] = useState(false);
  const isPrivateRepo = repo.isPrivate;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="gap-0 py-0 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/40 transition-colors text-left">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {isPrivateRepo && (
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="text-sm font-medium truncate block">
                  {isPrivateRepo ? "Private repository" : repo.repo}
                </span>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {repo.commitCount} commit{repo.commitCount !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="flex items-center gap-4 shrink-0 ml-4">
              <span className="text-sm font-mono font-semibold text-emerald-400">
                +{repo.additions.toLocaleString("en-US")}
              </span>
              <span className="text-sm font-mono font-semibold text-red-400">
                -{repo.deletions.toLocaleString("en-US")}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </div>
          </button>
        </CollapsibleTrigger>

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
                      className="text-sm text-muted-foreground hover:text-violet-400 transition-colors truncate block"
                    >
                      {c.message}
                    </a>
                  ) : c.isPrivate ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5 text-amber-300/80" />
                      <span className="truncate">Commit details hidden for private repository</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground truncate block">
                      {c.message}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/50 font-mono">
                    {c.isPrivate ? "SHA hidden" : c.sha.slice(0, 7)}
                  </span>
                </div>
                <div className="flex gap-3 shrink-0 text-sm font-mono">
                  <span className="text-emerald-400">
                    +{c.additions.toLocaleString("en-US")}
                  </span>
                  <span className="text-red-400">
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
