"use client";

import { Component, Suspense, use } from "react";
import { AlertCircle } from "lucide-react";
import type { DayStats } from "@/lib/github";
import StatsDisplay from "@/components/StatsDisplay";
import StatsSkeleton from "@/components/StatsSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function StatsContent({ promise }: { promise: Promise<DayStats> }) {
  const stats = use(promise);
  return <StatsDisplay stats={stats} />;
}

class StatsErrorBoundary extends Component<
  {
    children: React.ReactNode;
    fallback: React.ReactNode;
  },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function StatsError() {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Couldn&apos;t load stats</AlertTitle>
      <AlertDescription>
        <p className="text-muted-foreground">
          Check the username, try a shorter date range, or try again in a
          moment.
        </p>
      </AlertDescription>
    </Alert>
  );
}

export default function StatsResults({
  requestKey,
  promise,
}: {
  requestKey: string;
  promise: Promise<DayStats>;
}) {
  return (
    <StatsErrorBoundary
      key={requestKey}
      fallback={<StatsError />}
    >
      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent promise={promise} />
      </Suspense>
    </StatsErrorBoundary>
  );
}
