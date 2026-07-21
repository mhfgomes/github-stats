import Link from "next/link";
import { Github } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
        <p>
          Built with the GitHub REST API. Not affiliated with GitHub.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/banner"
            className="transition-colors hover:text-foreground"
          >
            Banners
          </Link>
          <a
            href="https://github.com/mhfgomes/github-stats"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}
