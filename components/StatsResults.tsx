"use client";

import { Component, Suspense, use, useEffect, useRef } from "react";
import type { DayStats } from "@/lib/github";
import StatsDisplay from "@/components/StatsDisplay";
import StatsSkeleton from "@/components/StatsSkeleton";
import { useToast } from "@/components/ToastProvider";

function StatsContent({ promise }: { promise: Promise<DayStats> }) {
  const stats = use(promise);
  return <StatsDisplay stats={stats} />;
}

function ErrorToast({ message }: { message: string }) {
  const { toast } = useToast();
  const didToast = useRef(false);

  useEffect(() => {
    if (didToast.current) return;
    didToast.current = true;
    toast({
      title: "Failed to fetch stats",
      description: message,
      tone: "destructive",
    });
  }, [message, toast]);

  return null;
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
        <ErrorToast
          message={error.message || "Something went wrong while fetching stats."}
        />
      )}
    >
      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent promise={promise} />
      </Suspense>
    </StatsErrorBoundary>
  );
}
