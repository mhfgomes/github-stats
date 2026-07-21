"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff, Loader2 } from "lucide-react";

interface Props {
  src: string;
  width: number;
  height: number;
  alt: string;
  emptyLabel: string;
}

type Status = "idle" | "loading" | "loaded" | "error";

export default function BannerPreview({
  src,
  width,
  height,
  alt,
  emptyLabel,
}: Props) {
  const [status, setStatus] = useState<Status>(src ? "loading" : "idle");
  const [prevSrc, setPrevSrc] = useState(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setStatus(src ? "loading" : "idle");
  }

  if (!src) {
    return (
      <div className="h-45 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="h-45 rounded-lg border border-dashed border-destructive/40 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
        <ImageOff className="h-5 w-5 text-destructive" />
        <span>
          Couldn&apos;t generate the banner. Check the username or try again in a
          moment.
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <Image
        key={src}
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="w-full rounded-lg border border-border"
        unoptimized
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-border bg-muted/60 backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
