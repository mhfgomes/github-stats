"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ToastProvider";

type BannerExportProps = {
  apiUrl: string;
  mdSnippet: string;
  enabled: boolean;
  emptyApiMessage?: string;
};

export default function BannerExport({
  apiUrl,
  mdSnippet,
  enabled,
  emptyApiMessage = "Fill in a username to generate the API link.",
}: BannerExportProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<"api" | "md" | null>(null);

  async function copy(type: "api" | "md") {
    await navigator.clipboard.writeText(type === "api" ? apiUrl : mdSnippet);
    setCopied(type);
    toast({
      title: type === "api" ? "API link copied" : "README snippet copied",
      durationMs: 2000,
    });
    window.setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Export
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => copy("api")}
            className="flex-1 gap-2"
            disabled={!enabled}
          >
            {copied === "api" ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy API link
          </Button>
          <Button
            variant="outline"
            onClick={() => copy("md")}
            className="gap-2"
            disabled={!enabled}
          >
            {copied === "md" ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy README
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">API link</Label>
          <pre className="rounded-md bg-muted px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {enabled ? apiUrl : emptyApiMessage}
          </pre>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">README snippet</Label>
          <pre className="rounded-md bg-muted px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {mdSnippet}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
