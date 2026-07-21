"use client";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(range: DateRange | undefined) {
  if (!range?.from) return "Pick a date range";
  if (!range.to || range.to.getTime() === range.from.getTime()) {
    return formatDate(range.from);
  }
  return `${formatDate(range.from)} - ${formatDate(range.to)}`;
}

interface Props {
  label: string;
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
  disabled?: boolean;
}

export default function DateRangePicker({
  label,
  value,
  onChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  function handleSelect(range: DateRange | undefined) {
    onChange(range);
    // A distinct start and end means the selection is complete; close so the
    // user immediately sees the updated value. Single-day picks keep the
    // popover open (the second click could still extend the range).
    if (
      range?.from &&
      range.to &&
      range.from.getTime() !== range.to.getTime()
    ) {
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full sm:w-[280px] justify-start gap-2 text-left font-normal"
          aria-label={label}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span
            className={
              !value?.from
                ? "text-muted-foreground truncate"
                : "truncate"
            }
          >
            {formatRange(value)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={handleSelect}
          autoFocus
          disabled={{ after: new Date() }}
        />
        <Separator />
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {value?.from
              ? formatRange(value)
              : "Select a start and end day"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2.5 text-xs"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
