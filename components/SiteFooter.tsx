import Link from "next/link";
import { BarChart2, ImageIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>GitHub Daily Stats</p>
        <nav className="flex items-center gap-4" aria-label="Footer">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Stats
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Link
            href="/banner"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Banners
          </Link>
        </nav>
      </div>
    </footer>
  );
}
