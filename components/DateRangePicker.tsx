"use client";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(range: DateRange | undefined) {
  if (!range?.from) return "Pick a date range";
  if (!range.to) return formatDate(range.from);
  return `${formatDate(range.from)} - ${formatDate(range.to)}`;
}

interface Props {
  label: string;
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
}

export default function DateRangePicker({ label, value, onChange }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[280px] justify-start gap-2 text-left font-normal"
          aria-label={label}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className={!value?.from ? "text-muted-foreground" : undefined}>
            {formatRange(value)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
