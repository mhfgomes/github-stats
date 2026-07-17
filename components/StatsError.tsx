"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  onRetry: () => void;
}

export default function StatsError({ message, onRetry }: Props) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Failed to fetch stats</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
        >
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
