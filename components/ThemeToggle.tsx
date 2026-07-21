"use client";

import { useCallback } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const nextLabel =
    resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      const next = resolvedTheme === "dark" ? "light" : "dark";

      if (!document.startViewTransition || prefersReducedMotion()) {
        setTheme(next);
        return;
      }

      document.documentElement.style.setProperty("--x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--y", `${e.clientY}px`);

      document.startViewTransition(() => {
        setTheme(next);
      });
    },
    [resolvedTheme, setTheme]
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={nextLabel}
      title={nextLabel}
      onClick={toggle}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
