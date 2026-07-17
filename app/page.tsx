"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SearchForm from "@/components/SearchForm";
import StatsResults, { type StatsStatus } from "@/components/StatsResults";
import type { DayStats } from "@/lib/github";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ToastProvider";

const ThemeToggle = dynamic(
  () => import("@/components/ThemeToggle").then((m) => m.ThemeToggle),
  { ssr: false }
);

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const urlUsername = searchParams.get("username")?.trim() ?? "";
  const urlFrom = searchParams.get("from") ?? todayIso();
  const urlTo = searchParams.get("to") ?? urlFrom;

  const [formKey, setFormKey] = useState(0);
  const [formUsername, setFormUsername] = useState(urlUsername);
  const [formFrom, setFormFrom] = useState(urlFrom);
  const [formTo, setFormTo] = useState(urlTo);
  const [status, setStatus] = useState<StatsStatus>(() =>
    urlUsername ? { type: "loading" } : { type: "idle" }
  );
  const [lastQuery, setLastQuery] = useState<{
    username: string;
    from: string;
    to: string;
  } | null>(
    urlUsername ? { username: urlUsername, from: urlFrom, to: urlTo } : null
  );

  const requestId = useRef(0);
  const bootedUrl = useRef(urlUsername);

  const syncUrl = useCallback(
    (username: string, from: string, to: string) => {
      const params = new URLSearchParams();
      params.set("username", username);
      params.set("from", from);
      params.set("to", to);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router]
  );

  const runSearch = useCallback(
    async (username: string, from: string, to: string, remountForm = false) => {
      const trimmed = username.trim();
      if (!trimmed) return;

      setFormUsername(trimmed);
      setFormFrom(from);
      setFormTo(to);
      setLastQuery({ username: trimmed, from, to });
      if (remountForm) setFormKey((k) => k + 1);
      syncUrl(trimmed, from, to);

      const id = ++requestId.current;
      setStatus({ type: "loading" });

      try {
        const params = new URLSearchParams({ username: trimmed, from, to });
        const res = await fetch(`/api/stats?${params}`);
        const data = await res.json();

        if (id !== requestId.current) return;

        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        setStatus({ type: "success", stats: data as DayStats });
      } catch (err) {
        if (id !== requestId.current) return;
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong while fetching stats.";
        setStatus({ type: "error", message });
        toast({
          title: "Failed to fetch stats",
          description: message,
          tone: "destructive",
        });
      }
    },
    [syncUrl, toast]
  );

  useEffect(() => {
    if (!bootedUrl.current) return;
    const username = bootedUrl.current;
    bootedUrl.current = "";
    void runSearch(username, urlFrom, urlTo);
    // Intentionally run once for deep-linked URL queries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExample(username: string) {
    const from = todayIso();
    void runSearch(username, from, from, true);
  }

  function handleRetry() {
    if (!lastQuery) return;
    void runSearch(lastQuery.username, lastQuery.from, lastQuery.to);
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-start justify-between mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">
              GitHub Daily Stats
            </h1>
            <p className="text-muted-foreground text-sm">
              Additions &amp; deletions by user, per repository.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
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
            <SearchForm
              key={formKey}
              onSearch={(username, from, to) => void runSearch(username, from, to)}
              loading={status.type === "loading"}
              initialUsername={formUsername}
              initialFrom={formFrom}
              initialTo={formTo}
            />
          </CardContent>
        </Card>

        <StatsResults
          status={status}
          onRetry={handleRetry}
          onExample={handleExample}
        />
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <div className="max-w-3xl mx-auto px-4 py-12">
            <div className="h-10 w-64 rounded bg-muted animate-pulse mb-10" />
            <div className="h-28 rounded-xl border bg-card mb-8" />
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
