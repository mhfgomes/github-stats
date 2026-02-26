"use client";

import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  label: string;
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  min?: string;
}

export default function DatePicker({ label, value, onChange, min }: Props) {
  const selected = value
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : undefined;

  const minDate = min
    ? new Date(Number(min.slice(0, 4)), Number(min.slice(5, 7)) - 1, Number(min.slice(8, 10)))
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[180px] justify-start gap-2 font-normal"
          aria-label={label}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {value ? formatDate(value) : <span className="text-muted-foreground">Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (!day) return;
            const y = day.getFullYear();
            const m = String(day.getMonth() + 1).padStart(2, "0");
            const d = String(day.getDate()).padStart(2, "0");
            onChange(`${y}-${m}-${d}`);
          }}
          disabled={minDate ? (day) => day < minDate : undefined}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
