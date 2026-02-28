"use client";

import Link from "next/link";
import { ArrowLeft, BarChart2, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import dynamic from "next/dynamic";

const ThemeToggle = dynamic(
  () => import("@/components/ThemeToggle").then((m) => m.ThemeToggle),
  { ssr: false }
);

export default function BannerIndexPage() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Stats
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Banner Generator
              </h1>
              <p className="text-muted-foreground text-sm">
                Pick a banner type to generate and embed.
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/banner/stats" className="group">
            <Card className="h-full transition-colors hover:border-ring cursor-pointer">
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
                <span className="text-sm font-medium text-primary mt-auto">
                  Open →
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link href="/banner/langs" className="group">
            <Card className="h-full transition-colors hover:border-ring cursor-pointer">
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
                <span className="text-sm font-medium text-primary mt-auto">
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
