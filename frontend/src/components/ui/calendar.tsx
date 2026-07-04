import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";
import { DayPicker } from "react-day-picker";

function CalendarDropdown(props: Record<string, unknown>) {
  const {
    options,
    value,
    onChange,
    className: _cls,
    components: _c,
    classNames: _cn,
    ...rest
  } = props as {
    options?: { value: number; label: string; disabled: boolean }[];
    value?: number;
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    className?: string;
    components?: unknown;
    classNames?: unknown;
    [key: string]: unknown;
  };

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Scroll selected item into view on open
  useEffect(() => {
    if (!open || !listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected]");
    if (selected) selected.scrollIntoView({ block: "center" });
  }, [open]);

  const selectedOption = options?.find((o) => o.value === value);

  // Keep rest props out of the DOM (aria-label etc. are fine)
  const { disabled, ...safeRest } = rest as { disabled?: boolean; [k: string]: unknown };

  return (
    <div ref={containerRef} className="relative" {...safeRest}>
      <button
        type="button"
        disabled={!!disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "border border-input rounded-lg px-2 h-8",
          "flex items-center gap-1 text-sm",
          "hover:bg-accent transition-colors cursor-pointer",
          "disabled:pointer-events-none disabled:opacity-50",
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
          {options?.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              data-selected={opt.value === value ? "" : undefined}
              onClick={() => {
                onChange?.({
                  target: { value: String(opt.value) },
                } as React.ChangeEvent<HTMLSelectElement>);
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

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = {
    button_next: cn(
      "inline-flex items-center justify-center rounded-lg h-9 w-9 text-sm",
      "text-foreground hover:bg-accent",
      "disabled:pointer-events-none disabled:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:h-4 [&_svg]:w-4",
    ),
    button_previous: cn(
      "inline-flex items-center justify-center rounded-lg h-9 w-9 text-sm",
      "text-foreground hover:bg-accent",
      "disabled:pointer-events-none disabled:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:h-4 [&_svg]:w-4",
    ),
    caption_label: "text-sm font-medium flex items-center gap-2 h-full",
    day: cn(
      "h-9 w-9 text-sm p-0",
      "data-[selected]:has-[button]:rounded-lg",
      "[&[data-selected]>button]:bg-primary [&[data-selected]>button]:text-primary-foreground [&[data-selected]>button]:hover:bg-primary/90",
    ),
    day_button: cn(
      "inline-flex items-center justify-center rounded-lg h-9 w-9 text-sm",
      "text-foreground hover:bg-accent",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[disabled]:text-muted-foreground/50 data-[disabled]:line-through",
      "data-[outside]:text-muted-foreground/50",
      "outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
      "transition-colors",
    ),
    dropdown: cn(
      "absolute inset-0 opacity-0 cursor-pointer",
    ),
    dropdown_root: cn(
      "relative border border-input rounded-lg px-2 h-8",
      "flex items-center text-sm",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:opacity-60",
    ),
    dropdowns: cn(
      "w-full flex items-center justify-center h-9 gap-1.5",
    ),
    hidden: "invisible",
    month: "w-full",
    month_caption:
      "relative mx-9 px-1 mb-1 flex h-9 items-center justify-center z-[2]",
    months: "relative flex flex-col gap-2",
    nav: "absolute top-0 flex w-full justify-between z-[1]",
    outside: "text-muted-foreground/50 data-[selected]:bg-accent/50 data-[selected]:text-muted-foreground",
    range_end: "range-end",
    range_middle: "range-middle",
    range_start: "range-start",
    today: cn(
      "[&>button]:relative",
      "[&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2",
      "[&>button]:after:h-[3px] [&>button]:after:w-[3px] [&>button]:after:-translate-x-1/2",
      "[&>button]:after:rounded-full [&>button]:after:bg-primary",
      "[&[data-selected]>button]:after:bg-primary-foreground",
      "[&>button]:after:transition-colors",
    ),
    weekday: "h-9 w-9 p-0 text-xs font-medium text-muted-foreground/70",
  };

  const mergedClassNames: typeof defaultClassNames = Object.keys(
    defaultClassNames,
  ).reduce(
    (acc, key) => {
      const userClass = classNames?.[key as keyof typeof classNames];
      const baseClass = defaultClassNames[key as keyof typeof defaultClassNames];
      acc[key as keyof typeof defaultClassNames] = userClass
        ? cn(baseClass, userClass)
        : baseClass;
      return acc;
    },
    { ...defaultClassNames } as typeof defaultClassNames,
  );

  const defaultComponents = {
    Dropdown: CalendarDropdown,
    Chevron: ({
      className: chevronClassName,
      orientation,
      ...chevronProps
    }: {
      className?: string;
      orientation?: "left" | "right" | "up" | "down";
    }) => {
      if (orientation === "left") {
        return (
          <ChevronLeftIcon
            className={cn(chevronClassName)}
            {...chevronProps}
            aria-hidden="true"
          />
        );
      }
      return (
        <ChevronRightIcon
          className={cn(chevronClassName)}
          {...chevronProps}
          aria-hidden="true"
        />
      );
    },
  };

  const mergedComponents = {
    ...defaultComponents,
    ...userComponents,
  };

  return (
    <DayPicker
      data-slot="calendar"
      className={cn("w-fit", className)}
      classNames={mergedClassNames}
      components={mergedComponents}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

export { Calendar };
