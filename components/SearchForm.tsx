"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import DateRangePicker from "@/components/DateRangePicker";
import { cn } from "@/lib/utils";

interface Props {
  onSearch: (username: string, from: string, to: string) => void;
  isSearching?: boolean;
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
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

type PresetId = "today" | "yesterday" | "last7" | "thismonth";

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "thismonth", label: "This month" },
];

function rangeForPreset(id: PresetId): DateRange {
  const end = today();
  const start = today();

  if (id === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (id === "last7") {
    start.setDate(start.getDate() - 6);
  } else if (id === "thismonth") {
    start.setDate(1);
  }

  return { from: start, to: end };
}

function matchPreset(range: DateRange | undefined): PresetId | null {
  if (!range?.from) return null;
  const from = toIsoDate(range.from);
  const to = toIsoDate(range.to ?? range.from);

  for (const preset of PRESETS) {
    const candidate = rangeForPreset(preset.id);
    if (
      toIsoDate(candidate.from!) === from &&
      toIsoDate(candidate.to!) === to
    ) {
      return preset.id;
    }
  }
  return null;
}

export default function SearchForm({
  onSearch,
  isSearching = false,
  initialUsername = "",
  initialFrom,
  initialTo,
}: Props) {
  const [username, setUsername] = useState(initialUsername);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseIsoDate(initialFrom);
    const to = parseIsoDate(initialTo) ?? from;
    if (from) return { from, to: to ?? from };
    return rangeForPreset("today");
  });

  const activePreset = useMemo(() => matchPreset(range), [range]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !range?.from || isSearching) return;
    const from = toIsoDate(range.from);
    const to = toIsoDate(range.to ?? range.from);
    onSearch(username.trim(), from, to);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={activePreset === preset.id ? "default" : "outline"}
            className={cn(
              "h-7 px-2.5 text-xs",
              activePreset === preset.id && "pointer-events-none"
            )}
            onClick={() => setRange(rangeForPreset(preset.id))}
            disabled={isSearching}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <Label htmlFor="username">GitHub Username</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. torvalds"
            autoComplete="username"
            spellCheck={false}
            required
            disabled={isSearching}
          />
        </div>

        <div className="flex flex-col gap-1.5 w-full sm:w-auto">
          <Label htmlFor="date-range">Date Range</Label>
          <DateRangePicker
            id="date-range"
            label="Date range"
            value={range}
            onChange={setRange}
            disabled={isSearching}
          />
        </div>

        <Button type="submit" disabled={isSearching || !username.trim()} className="w-full sm:w-auto">
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </>
          ) : (
            "Search"
          )}
        </Button>
      </div>
    </form>
  );
}
