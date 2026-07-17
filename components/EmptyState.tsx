"use client";

import Link from "next/link";
import { ImageIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXAMPLES = [
  { username: "torvalds", label: "torvalds" },
  { username: "gaearon", label: "gaearon" },
  { username: "tj", label: "tj" },
] as const;

interface Props {
  onExample: (username: string) => void;
}

export default function EmptyState({ onExample }: Props) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-10 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted/40">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="max-w-sm space-y-2">
        <h2 className="text-base font-semibold tracking-tight">
          Look up a GitHub user
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Enter a username and date range to see additions, deletions, and
          commits by repository.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground w-full sm:w-auto">
          Try
        </span>
        {EXAMPLES.map((example) => (
          <Button
            key={example.username}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onExample(example.username)}
          >
            @{example.label}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Or{" "}
        <Link
          href="/banner"
          className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          generate a shareable banner
        </Link>
      </p>
    </div>
  );
}
