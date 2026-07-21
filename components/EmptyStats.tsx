import Image from "next/image";
import Link from "next/link";

export default function EmptyStats() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/80 px-6 py-14 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.58_0.09_210_/_0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.72_0.1_210_/_0.16),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-sm flex-col items-center">
        <span className="mb-4 relative h-12 w-12 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          <Image
            src="/icon-light.png"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 dark:hidden"
          />
          <Image
            src="/icon-dark.png"
            alt=""
            width={48}
            height={48}
            className="hidden h-12 w-12 dark:block"
          />
        </span>
        <p className="text-base font-semibold tracking-tight">
          Look up a GitHub user
        </p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Enter a username and date range to see commits, additions, and
          deletions broken down by repository.
        </p>
        <p className="mt-5 text-sm text-muted-foreground">
          Or{" "}
          <Link
            href="/banner"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            generate a README banner
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
