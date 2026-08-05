"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff, Loader2 } from "lucide-react";

interface Props {
  /** Banner SVG URL, or empty string when there is nothing to preview yet. */
  src: string;
  /** True while the user is still editing and a new src is about to arrive. */
  pending?: boolean;
  alt: string;
  width: number;
  height: number;
  emptyMessage: string;
}

export default function BannerPreview({
  src,
  pending = false,
  alt,
  width,
  height,
  emptyMessage,
}: Props) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset to loading whenever a new src arrives (adjust-state-during-render pattern).
  if (src !== prevSrc) {
    setPrevSrc(src);
    setStatus("loading");
  }

  if (!src) {
    return (
      <div className="h-45 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  if (status === "error" && !pending) {
    return (
      <div className="h-45 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground px-6 text-center">
        <ImageOff className="h-5 w-5" aria-hidden />
        <p>Couldn&apos;t load the preview.</p>
        <p className="text-xs">
          Check that the username exists, or try again in a moment.
        </p>
      </div>
    );
  }

  const busy = pending || status === "loading";

  return (
    <div className="relative">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="w-full rounded-lg border border-border"
        unoptimized
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
      {busy && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]"
          role="status"
          aria-label="Updating preview"
        >
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      )}
    </div>
  );
}
