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
    fallback: (error: Error) => React.ReactNode;
  },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }

    return this.props.children;
  }
}

function StatsError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Couldn&apos;t load stats</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <p className="mt-1 text-muted-foreground">
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
      fallback={(error) => (
        <StatsError
          message={
            error.message || "Something went wrong while fetching stats."
          }
        />
      )}
    >
      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent promise={promise} />
      </Suspense>
    </StatsErrorBoundary>
  );
}
