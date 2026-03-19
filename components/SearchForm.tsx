"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import DateRangePicker from "@/components/DateRangePicker";

interface Props {
  onSearch: (username: string, from: string, to: string) => void;
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

export default function SearchForm({ onSearch }: Props) {
  const [username, setUsername] = useState("");
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const date = today();
    return { from: date, to: date };
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !range?.from) return;
    const from = toIsoDate(range.from);
    const to = toIsoDate(range.to ?? range.from);
    onSearch(username.trim(), from, to);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 flex flex-col gap-1.5">
          <Label htmlFor="username">GitHub Username</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. torvalds"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Date Range</Label>
          <DateRangePicker
            label="Date range"
            value={range}
            onChange={setRange}
          />
        </div>

        <Button type="submit">Search</Button>
      </div>
    </form>
  );
}
