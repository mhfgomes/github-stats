"use client";

import Link from "next/link";
import { BarChart2, Languages } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

export default function BannerIndexPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <AppHeader
          title="Banner Generator"
          description="Pick a banner type to generate and embed."
          backHref="/"
          backLabel="Stats"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/banner/stats" className="group block focus-visible:outline-none">
            <Card className="h-full transition-colors hover:border-ring group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring/40 cursor-pointer">
              <CardContent className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                    <BarChart2 className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold">Stats Banner</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Commits, additions and deletions for any date range. Embed in
                  your README or profile.
                </p>
                <span className="text-sm font-medium text-primary mt-auto group-hover:underline underline-offset-4">
                  Open →
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link href="/banner/langs" className="group block focus-visible:outline-none">
            <Card className="h-full transition-colors hover:border-ring group-focus-visible:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring/40 cursor-pointer">
              <CardContent className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                    <Languages className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold">Languages Banner</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Most used programming languages all time, calculated from all
                  your repositories.
                </p>
                <span className="text-sm font-medium text-primary mt-auto group-hover:underline underline-offset-4">
                  Open →
                </span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
