"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const ThemeToggle = dynamic(
  () => import("@/components/ThemeToggle").then((m) => m.ThemeToggle),
  { ssr: false }
);

type AppHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  showBannerLink?: boolean;
};

export default function AppHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  showBannerLink = false,
}: AppHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8 sm:mb-10">
      <div className="flex items-start gap-3 min-w-0">
        {backHref ? (
          <Button variant="ghost" size="sm" asChild className="shrink-0 mt-0.5">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          </Button>
        ) : null}

        <div className="flex items-start gap-3 min-w-0">
          <Link
            href="/"
            aria-label="GitHub Daily Stats home"
            className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Image
              src="/icon-light.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 dark:hidden"
              priority
            />
            <Image
              src="/icon-dark.png"
              alt=""
              width={36}
              height={36}
              className="hidden h-9 w-9 dark:block"
              priority
            />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground text-sm">{description}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {showBannerLink ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/banner">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Banner</span>
            </Link>
          </Button>
        ) : null}
        <ThemeToggle />
      </div>
    </div>
  );
}
