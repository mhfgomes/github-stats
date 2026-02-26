"use client";

import { useState } from "react";
import SearchForm from "@/components/SearchForm";
import StatsDisplay from "@/components/StatsDisplay";
import type { DayStats } from "@/lib/github";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, ImageIcon } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ThemeToggle = dynamic(
  () => import("@/components/ThemeToggle").then((m) => m.ThemeToggle),
  { ssr: false }
);

export default function Home() {
  const [stats, setStats] = useState<DayStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(username: string, from: string, to: string) {
    setLoading(true);
    setError(null);
    setStats(null);

    try {
      const params = new URLSearchParams({ username, from, to });
      const res = await fetch(`/api/stats?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
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
            <SearchForm onSearch={handleSearch} loading={loading} />
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Fetching commits…</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {stats && !loading && <StatsDisplay stats={stats} />}
      </div>
    </main>
  );
}
