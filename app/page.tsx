"use client";

import { useCallback, useState } from "react";
import SearchForm from "@/components/SearchForm";
import StatsResults from "@/components/StatsResults";
import AppHeader from "@/components/AppHeader";
import type { DayStats } from "@/lib/github";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

function readSearchParams() {
  if (typeof window === "undefined") {
    return {
      username: "",
      from: undefined as string | undefined,
      to: undefined as string | undefined,
    };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    username: params.get("username")?.trim() ?? "",
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };
}

function startFetch(
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

function createRequest(username: string, from: string, to: string) {
  return {
    key: `${username}:${from}:${to}:${Date.now()}`,
    promise: startFetch(username, from, to),
  };
}

export default function Home() {
  const [initial] = useState(readSearchParams);
  const [request, setRequest] = useState<{
    key: string;
    promise: Promise<DayStats>;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const params = readSearchParams();
    if (!params.username || !params.from) return null;
    return createRequest(
      params.username,
      params.from,
      params.to ?? params.from
    );
  });
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(
    (username: string, from: string, to: string) => {
      const params = new URLSearchParams({ username, from, to });
      window.history.replaceState(null, "", `?${params.toString()}`);

      setIsSearching(true);
      const next = createRequest(username, from, to);
      next.promise.finally(() => {
        setIsSearching(false);
      });
      setRequest(next);
    },
    []
  );

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <AppHeader
          title="GitHub Daily Stats"
          description="Additions & deletions by user, per repository."
          showBannerLink
        />

        <Card className="mb-8 py-0">
          <CardContent className="p-4 sm:p-6">
            <SearchForm
              onSearch={handleSearch}
              isSearching={isSearching}
              initialUsername={initial.username}
              initialFrom={initial.from}
              initialTo={initial.to}
            />
          </CardContent>
        </Card>

        {request ? (
          <StatsResults requestKey={request.key} promise={request.promise} />
        ) : (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Look up a GitHub user</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Enter a username and date range to see commits, additions, and
              deletions broken down by repository.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
