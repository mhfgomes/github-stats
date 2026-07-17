"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import DateRangePicker from "@/components/DateRangePicker";

interface Props {
  onSearch: (username: string, from: string, to: string) => void;
  loading?: boolean;
  initialUsername?: string;
  initialFrom?: string;
  initialTo?: string;
}

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string | undefined) {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export default function SearchForm({
  onSearch,
  loading = false,
  initialUsername = "",
  initialFrom,
  initialTo,
}: Props) {
  const [username, setUsername] = useState(initialUsername);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseIsoDate(initialFrom) ?? today();
    const to = parseIsoDate(initialTo) ?? from;
    return { from, to };
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !username.trim() || !range?.from) return;
    const from = toIsoDate(range.from);
    const to = toIsoDate(range.to ?? range.from);
    onSearch(username.trim(), from, to);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 flex flex-col gap-1.5 w-full">
          <Label htmlFor="username">GitHub Username</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. torvalds"
            required
            disabled={loading}
            autoComplete="username"
          />
        </div>

        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <Label>Date Range</Label>
          <DateRangePicker
            label="Date range"
            value={range}
            onChange={setRange}
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !username.trim()}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching
            </>
          ) : (
            "Search"
          )}
        </Button>
      </div>
    </form>
  );
}
