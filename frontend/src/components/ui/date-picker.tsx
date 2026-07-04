import { format, parse, isValid } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function toDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatWithMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let result = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) result += "/";
    result += digits[i];
  }
  return result;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the popover opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build date with explicit year/month/day to avoid timezone issues
  const selectedDate = (() => {
    if (!value) return undefined;
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(toDateString(date));
    }
    setIsTyping(false);
    setInputValue("");
    setOpen(false);
  };

  const handleToday = () => {
    onChange(toDateString(new Date()));
    setIsTyping(false);
    setInputValue("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsTyping(false);
    setInputValue("");
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = formatWithMask(e.target.value);
    setInputValue(masked);
    setIsTyping(true);

    if (masked.length === 10) {
      const parsed = parse(masked, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onChange(toDateString(parsed));
        setIsTyping(false);
        setInputValue("");
        setOpen(false);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.length === 10) {
      const parsed = parse(inputValue, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onChange(toDateString(parsed));
        setIsTyping(false);
        setInputValue("");
        setOpen(false);
      }
    }
  };

  const handleInputBlur = () => {
    if (inputValue.length === 10) {
      const parsed = parse(inputValue, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onChange(toDateString(parsed));
      }
    }
    setIsTyping(false);
    setInputValue("");
    setIsFocused(false);
  };

  const displayValue = isTyping
    ? inputValue
    : selectedDate
      ? format(selectedDate, "dd/MM/yyyy")
      : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "relative flex items-center w-40 h-9 rounded-md border border-input bg-background shadow-sm cursor-pointer",
            "focus-within:ring-1 focus-within:ring-ring",
            className,
          )}
        >
          <CalendarDays className="absolute left-2.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
          <input
            ref={inputRef}
            value={displayValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            onFocus={() => { setIsFocused(true); setOpen(true); }}
            placeholder={open || isFocused ? "DD/MM/YYYY" : placeholder}
            className="w-full h-full bg-transparent pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate ?? undefined}
          startMonth={new Date(2000, 0)}
          endMonth={new Date(2050, 11)}
          formatters={{
            formatMonthDropdown: (date: Date) =>
              date.toLocaleString("default", { month: "short" }),
          }}
        />
        <div className="flex items-center justify-between border-t pt-2 mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleToday}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
