"use client";

import { useState } from "react";
import SearchForm from "@/components/SearchForm";
import StatsResults from "@/components/StatsResults";
import type { DayStats } from "@/lib/github";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ThemeToggle = dynamic(
  () => import("@/components/ThemeToggle").then((m) => m.ThemeToggle),
  { ssr: false }
);

export default function Home() {
  const [request, setRequest] = useState<{
    key: string;
    promise: Promise<DayStats>;
  } | null>(null);

  function fetchStats(
    username: string,
    from: string,
    to: string
  ): Promise<DayStats> {
    return (async () => {
      const params = new URLSearchParams({ username, from, to });
      const res = await fetch(`/api/stats?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      return data as DayStats;
    })();
  }

  function handleSearch(username: string, from: string, to: string) {
    setRequest({
      key: `${username}:${from}:${to}:${Date.now()}`,
      promise: fetchStats(username, from, to),
    });
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">
              GitHub Daily Stats
            </h1>
            <p className="text-muted-foreground text-sm">
              Additions &amp; deletions by user, per repository.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/banner">
                <ImageIcon className="h-4 w-4" />
                Banner
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <Card className="mb-8 py-0">
          <CardContent className="p-6">
            <SearchForm onSearch={handleSearch} />
          </CardContent>
        </Card>

        {request ? (
          <StatsResults requestKey={request.key} promise={request.promise} />
        ) : null}
      </div>
    </main>
  );
}
