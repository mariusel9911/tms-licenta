import { parseDate } from "@internationalized/date";
import { Calendar } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-aria-components";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RangeCalendar } from "@/components/ui/calendar-rac";
import { cn } from "@/lib/utils";

interface DateRangePickerRacProps {
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  className?: string;
}

export function DateRangePickerRac({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  className,
}: DateRangePickerRacProps) {
  const [open, setOpen] = useState(false);

  const value: DateRange = {
    start: parseDate(startDate),
    end: parseDate(endDate),
  };

  function handleChange(range: DateRange | null) {
    if (!range) return;
    if (range.start) onStartChange(range.start.toString());
    if (range.end) {
      onEndChange(range.end.toString());
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-foreground",
            "hover:bg-muted cursor-pointer transition-colors",
            className,
          )}
        >
          <span className="tabular-nums">
            {startDate} -- {endDate}
          </span>
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <RangeCalendar
          value={value}
          onChange={handleChange}
          className="rounded-lg"
        />
      </PopoverContent>
    </Popover>
  );
}
