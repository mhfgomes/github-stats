"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/DatePicker";

interface Props {
  onSearch: (username: string, from: string, to: string) => void;
  loading: boolean;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function SearchForm({ onSearch, loading }: Props) {
  const [username, setUsername] = useState("");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    onSearch(username.trim(), from, to);
  }

  function handleFromChange(value: string) {
    setFrom(value);
    if (value > to) setTo(value);
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
          <Label>From</Label>
          <DatePicker label="From date" value={from} onChange={handleFromChange} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>To</Label>
          <DatePicker label="To date" value={to} onChange={setTo} min={from} />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Loading…" : "Search"}
        </Button>
      </div>
    </form>
  );
}
