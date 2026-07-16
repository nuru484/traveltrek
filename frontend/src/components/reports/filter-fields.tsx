// src/components/reports/filter-fields.tsx
//
// The small labeled controls the report filter panels are built from: a
// field label, a "all + options" select, and the period control (preset
// select + custom range pickers).
"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PeriodSelection,
  PRESET_LABELS,
  REPORT_PRESETS,
} from "./report-filters-logic";

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

const titleize = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** "Booking status" -> "booking statuses"; "Tour type" -> "tour types". */
const pluralize = (label: string) => {
  const lower = label.toLowerCase();
  return lower.endsWith("s") ? `${lower}es` : `${lower}s`;
};

/** "All …" + enum options select; emits "all" for the cleared state. */
export function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value ?? "all"} onValueChange={onChange}>
        <SelectTrigger className="w-full cursor-pointer" aria-label={label}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All {pluralize(label)}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {titleize(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DatePickerButton({
  date,
  placeholder,
  onSelect,
}: {
  date?: Date;
  placeholder: string;
  onSelect: (date?: Date) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full cursor-pointer justify-start text-left font-normal",
            !date && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {date ? format(date, "MMM d, yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The period control: a preset select (THIS_MONTH default) plus, when
 * CUSTOM is chosen, from/to pickers with an explicit Apply so the queries
 * only refire once both dates are set.
 */
export function PeriodField({
  selection,
  onSelectionChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onApplyCustom,
}: {
  selection: PeriodSelection;
  onSelectionChange: (value: PeriodSelection) => void;
  customStart?: Date;
  customEnd?: Date;
  onCustomStartChange: (date?: Date) => void;
  onCustomEndChange: (date?: Date) => void;
  onApplyCustom: () => void;
}) {
  return (
    <div className={selection === "CUSTOM" ? "col-span-full" : ""}>
      <FieldLabel>Period</FieldLabel>
      <div
        className={cn(
          selection === "CUSTOM" &&
            "grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]",
        )}
      >
        <Select
          value={selection}
          onValueChange={(value) => onSelectionChange(value as PeriodSelection)}
        >
          <SelectTrigger className="w-full cursor-pointer" aria-label="Period">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {REPORT_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {PRESET_LABELS[preset]}
              </SelectItem>
            ))}
            <SelectItem value="CUSTOM">{PRESET_LABELS.CUSTOM}</SelectItem>
          </SelectContent>
        </Select>

        {selection === "CUSTOM" && (
          <>
            <DatePickerButton
              date={customStart}
              placeholder="From"
              onSelect={onCustomStartChange}
            />
            <DatePickerButton
              date={customEnd}
              placeholder="To"
              onSelect={onCustomEndChange}
            />
            <Button
              onClick={onApplyCustom}
              disabled={!customStart || !customEnd}
              className="cursor-pointer"
            >
              Apply
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
