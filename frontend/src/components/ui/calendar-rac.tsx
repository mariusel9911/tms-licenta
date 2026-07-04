import { cn } from "@/lib/utils";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  Button,
  CalendarCell as CalendarCellRac,
  CalendarGridBody as CalendarGridBodyRac,
  CalendarGridHeader as CalendarGridHeaderRac,
  CalendarGrid as CalendarGridRac,
  CalendarHeaderCell as CalendarHeaderCellRac,
  Calendar as CalendarRac,
  RangeCalendar as RangeCalendarRac,
  composeRenderProps,
} from "react-aria-components";

// ── CalendarDropdown (same pattern as calendar.tsx) ───────────────────────────

interface DropdownOption {
  value: number;
  label: string;
  disabled: boolean;
}

interface CalendarDropdownProps {
  options: DropdownOption[];
  value: number;
  onChange: (value: number) => void;
}

function CalendarDropdown({ options, value, onChange }: CalendarDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected]");
    if (selected) selected.scrollIntoView({ block: "center" });
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "border border-input rounded-lg px-2 h-8",
          "flex items-center gap-1 text-sm",
          "hover:bg-accent transition-colors cursor-pointer",
        )}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 opacity-60 shrink-0" />
      </button>
      {open && (
        <div
          ref={listRef}
          onWheel={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-full left-0 mt-1 z-50",
            "bg-popover border border-input rounded-lg shadow-md",
            "max-h-[200px] overflow-y-auto",
            "min-w-full py-1",
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              data-selected={opt.value === value ? "" : undefined}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "w-full px-2.5 py-1 text-sm text-left",
                "hover:bg-accent transition-colors",
                "disabled:opacity-50 disabled:pointer-events-none",
                opt.value === value && "bg-accent font-medium",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Month / year option builders ──────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEAR_START = 2000;
const YEAR_END = 2050;

function buildMonthOptions(): DropdownOption[] {
  return MONTH_NAMES.map((label, i) => ({ value: i + 1, label, disabled: false }));
}

function buildYearOptions(): DropdownOption[] {
  return Array.from({ length: YEAR_END - YEAR_START + 1 }, (_, i) => ({
    value: YEAR_START + i,
    label: String(YEAR_START + i),
    disabled: false,
  }));
}

const MONTH_OPTIONS = buildMonthOptions();
const YEAR_OPTIONS = buildYearOptions();

// ── Custom calendar header ────────────────────────────────────────────────────

interface CalendarHeaderProps {
  focusedDate: CalendarDate;
  onFocusChange: (d: CalendarDate) => void;
}

function CalendarHeaderWithDropdowns({ focusedDate, onFocusChange }: CalendarHeaderProps) {
  return (
    <header className="flex w-full items-center gap-1 pb-1">
      <Button
        slot="previous"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/80 outline-offset-2 transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-ring/70"
      >
        <ChevronLeftIcon className="h-4 w-4" strokeWidth={2} />
      </Button>

      <div className="flex flex-1 items-center justify-center gap-1.5">
        <CalendarDropdown
          options={MONTH_OPTIONS}
          value={focusedDate.month}
          onChange={(month) => onFocusChange(focusedDate.set({ month }))}
        />
        <CalendarDropdown
          options={YEAR_OPTIONS}
          value={focusedDate.year}
          onChange={(year) => onFocusChange(focusedDate.set({ year }))}
        />
      </div>

      <Button
        slot="next"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/80 outline-offset-2 transition-colors hover:bg-accent hover:text-foreground focus:outline-none data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-ring/70"
      >
        <ChevronRightIcon className="h-4 w-4" strokeWidth={2} />
      </Button>
    </header>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────

function CalendarGridComponent({ isRange = false }: { isRange?: boolean }) {
  const now = today(getLocalTimeZone());

  return (
    <CalendarGridRac>
      <CalendarGridHeaderRac>
        {(day) => (
          <CalendarHeaderCellRac className="size-9 rounded-lg p-0 text-xs font-medium text-muted-foreground/80">
            {day}
          </CalendarHeaderCellRac>
        )}
      </CalendarGridHeaderRac>
      <CalendarGridBodyRac className="[&_td]:px-0">
        {(date) => (
          <CalendarCellRac
            date={date}
            className={cn(
              "relative flex size-9 items-center justify-center whitespace-nowrap rounded-lg border border-transparent p-0 text-sm font-normal text-foreground outline-offset-2 duration-150 [transition-property:color,background-color,border-radius,box-shadow] focus:outline-none data-[disabled]:pointer-events-none data-[unavailable]:pointer-events-none data-[focus-visible]:z-10 data-[hovered]:bg-accent data-[selected]:bg-primary data-[hovered]:text-foreground data-[selected]:text-primary-foreground data-[unavailable]:line-through data-[disabled]:opacity-30 data-[unavailable]:opacity-30 data-[focus-visible]:outline data-[focus-visible]:outline-2 data-[focus-visible]:outline-ring/70",
              isRange &&
                "data-[selected]:rounded-none data-[selection-end]:rounded-e-lg data-[selection-start]:rounded-s-lg data-[invalid]:bg-red-100 data-[selected]:bg-accent data-[selected]:text-foreground data-[invalid]:data-[selection-end]:[&:not([data-hover])]:bg-destructive data-[invalid]:data-[selection-start]:[&:not([data-hover])]:bg-destructive data-[selection-end]:[&:not([data-hover])]:bg-primary data-[selection-start]:[&:not([data-hover])]:bg-primary data-[invalid]:data-[selection-end]:[&:not([data-hover])]:text-destructive-foreground data-[invalid]:data-[selection-start]:[&:not([data-hover])]:text-destructive-foreground data-[selection-end]:[&:not([data-hover])]:text-primary-foreground data-[selection-start]:[&:not([data-hover])]:text-primary-foreground",
              date.compare(now) === 0 &&
                cn(
                  "after:pointer-events-none after:absolute after:bottom-1 after:start-1/2 after:z-10 after:size-[3px] after:-translate-x-1/2 after:rounded-full after:bg-primary",
                  isRange
                    ? "data-[selection-end]:[&:not([data-hover])]:after:bg-background data-[selection-start]:[&:not([data-hover])]:after:bg-background"
                    : "data-[selected]:after:bg-background",
                ),
            )}
          />
        )}
      </CalendarGridBodyRac>
    </CalendarGridRac>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────

type CalendarProps = ComponentProps<typeof CalendarRac> & { className?: string };

function Calendar({ className, ...props }: CalendarProps) {
  const [focusedDate, setFocusedDate] = useState<CalendarDate>(() => today(getLocalTimeZone()));

  return (
    <CalendarRac
      {...props}
      focusedValue={focusedDate}
      onFocusChange={(d) => setFocusedDate(d as CalendarDate)}
      className={composeRenderProps(className, (cls) => cn("w-fit", cls))}
    >
      <CalendarHeaderWithDropdowns focusedDate={focusedDate} onFocusChange={setFocusedDate} />
      <CalendarGridComponent />
    </CalendarRac>
  );
}

// ── RangeCalendar ─────────────────────────────────────────────────────────────

type RangeCalendarProps = ComponentProps<typeof RangeCalendarRac> & { className?: string };

function RangeCalendar({ className, value, defaultValue, ...props }: RangeCalendarProps) {
  const [focusedDate, setFocusedDate] = useState<CalendarDate>(() => {
    const start = value?.start ?? defaultValue?.start;
    if (start && "year" in start) return start as CalendarDate;
    return today(getLocalTimeZone());
  });

  return (
    <RangeCalendarRac
      {...props}
      value={value}
      defaultValue={defaultValue}
      focusedValue={focusedDate}
      onFocusChange={(d) => setFocusedDate(d as CalendarDate)}
      className={composeRenderProps(className, (cls) => cn("w-fit", cls))}
    >
      <CalendarHeaderWithDropdowns focusedDate={focusedDate} onFocusChange={setFocusedDate} />
      <CalendarGridComponent isRange />
    </RangeCalendarRac>
  );
}

export { Calendar, RangeCalendar };
