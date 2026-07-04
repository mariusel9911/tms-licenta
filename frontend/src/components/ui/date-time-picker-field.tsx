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

// ─── Public helpers (exported for tests) ──────────────────────────────────────

/** ISO string → "dd-mm-yyyy HH:mm" in local time. Returns '' for empty/invalid. */
export function isoToRoDateTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd-MM-yyyy HH:mm');
  } catch {
    return '';
  }
}

/**
 * "dd-mm-yyyy HH:mm" → ISO string (treating input as local wall-clock time).
 * Returns null for incomplete or invalid input.
 */
export function roDateTimeToIso(s: string): string | null {
  if (!s || s.length !== 16) return null;
  try {
    const parsed = parse(s, 'dd-MM-yyyy HH:mm', new Date());
    if (!isValid(parsed)) return null;
    return parsed.toISOString();
  } catch {
    return null;
  }
}

/**
 * Applies the Romanian datetime mask to a raw input string.
 * Strips non-digits, accepts up to 12 digits, inserts separators:
 *   dd-mm-yyyy HH:mm
 */
/** Applies HH:mm mask to a raw input — strips non-digits, inserts ':' after hour digits. */
export function applyTimeMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function applyRoMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  let result = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) result += '-';
    else if (i === 8) result += ' ';
    else if (i === 10) result += ':';
    result += digits[i];
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DateTimePickerFieldProps {
  /** ISO 8601 string, or '' for empty */
  value: string;
  /** Called with ISO string on valid input, or '' when cleared */
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Forwarded to the inner <input> for RHF label association */
  id?: string;
  /** Forwarded to the inner <input> for RHF */
  name?: string;
}

export function DateTimePickerField({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy HH:mm',
  className,
  disabled,
  id,
  name,
}: DateTimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [timeInputValue, setTimeInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived from value prop — both in local time
  const selectedDate = value ? new Date(value) : undefined;
  const timeValue = selectedDate ? format(selectedDate, 'HH:mm') : '';

  // Auto-focus the text input when popover opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const displayValue = isTyping
    ? inputValue
    : value
      ? isoToRoDateTime(value)
      : '';

  // ── Text input handlers ──────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyRoMask(e.target.value);
    setInputValue(masked);
    setIsTyping(true);

    // Commit as soon as the full 16-char mask is satisfied
    if (masked.length === 16) {
      const iso = roDateTimeToIso(masked);
      if (iso) {
        onChange(iso);
        setIsTyping(false);
        setInputValue('');
        setOpen(false);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isTyping && inputValue.length === 16) {
      const iso = roDateTimeToIso(inputValue);
      if (iso) {
        onChange(iso);
        setIsTyping(false);
        setInputValue('');
        setOpen(false);
      }
    }
  };

  const handleInputBlur = () => {
    if (isTyping) {
      if (inputValue.length === 16) {
        const iso = roDateTimeToIso(inputValue);
        if (iso) onChange(iso);
        // Invalid input: silently revert to last committed value (no onChange call)
      }
      setIsTyping(false);
      setInputValue('');
    }
    setIsFocused(false);
  };

  // ── Popover calendar handler ────────────────────────────────────────────

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const [hh, mm] = timeValue ? timeValue.split(':').map(Number) : [0, 0];
    const merged = new Date(
      date.getFullYear(), date.getMonth(), date.getDate(),
      hh, mm,
    );
    onChange(merged.toISOString());
    setIsTyping(false);
    setInputValue('');
    // Keep popover open so user can also adjust time
  };

  // ── Time input handler (24h masked text input) ─────────────────────────

  const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyTimeMask(e.target.value);
    setTimeInputValue(masked);
    if (masked.length === 5 && selectedDate) {
      const [hh, mm] = masked.split(':').map(Number);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
        const merged = new Date(
          selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
          hh, mm,
        );
        onChange(merged.toISOString());
        setTimeInputValue('');
      }
    }
  };

  const handleTimeInputBlur = () => {
    // Revert incomplete time entry to committed value
    setTimeInputValue('');
  };

  // ── Footer button handlers ──────────────────────────────────────────────

  const handleClear = () => {
    onChange('');
    setIsTyping(false);
    setInputValue('');
    setOpen(false);
  };

  const handleNow = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    onChange(now.toISOString());
    setIsTyping(false);
    setInputValue('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'relative flex items-center w-full h-9 rounded-md border border-input bg-background shadow-sm cursor-pointer',
            'focus-within:ring-1 focus-within:ring-ring',
            disabled && 'opacity-50 pointer-events-none',
            className,
          )}
        >
          <CalendarDays className="absolute left-2.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
          <input
            ref={inputRef}
            id={id}
            name={name}
            value={displayValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            onFocus={() => { setIsFocused(true); setOpen(true); }}
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            placeholder={open || isFocused ? 'dd-mm-yyyy HH:mm' : placeholder}
            disabled={disabled}
            className="w-full h-full bg-transparent pl-8 pr-2 text-sm text-cyan-700 font-medium outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selectedDate}
          onSelect={handleCalendarSelect}
          defaultMonth={selectedDate ?? undefined}
          startMonth={new Date(2000, 0)}
          endMonth={new Date(2050, 11)}
          formatters={{
            formatMonthDropdown: (date: Date) =>
              date.toLocaleString('default', { month: 'short' }),
          }}
        />
        <div className="flex items-center justify-between gap-2 border-t pt-2 mt-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="HH:mm"
            value={timeInputValue || timeValue}
            onChange={handleTimeInputChange}
            onBlur={handleTimeInputBlur}
            disabled={!selectedDate}
            className={cn(
              'h-8 w-20 rounded-md border border-input bg-background px-2 text-sm',
              'focus:outline-none focus:ring-1 focus:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />
          <div className="flex gap-1">
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
              onClick={handleNow}
            >
              Now
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
