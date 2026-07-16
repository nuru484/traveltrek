// src/components/reports/report-filters-logic.ts
//
// Pure logic for the report filter bar: preset → API date-range mapping and
// the active-filter count. Kept free of React so it's unit-testable.
//
// The backend has no preset support — the UI maps each preset onto the
// reports API's startDate/endDate. Dates are built in local time (matching
// what the user's calendar shows); endDate carries an explicit end-of-day
// time so the whole final day is included (the API parses date-only strings
// as midnight, which would silently drop the last day's rows).

export const REPORT_PRESETS = [
  "TODAY",
  "THIS_WEEK",
  "THIS_MONTH",
  "LAST_MONTH",
  "THIS_QUARTER",
  "THIS_YEAR",
  "LAST_YEAR",
] as const;

export type ReportPreset = (typeof REPORT_PRESETS)[number];

/** The period control's value: a preset or an explicit custom range. */
export type PeriodSelection = ReportPreset | "CUSTOM";

export const DEFAULT_PRESET: PeriodSelection = "THIS_MONTH";

export const PRESET_LABELS: Record<PeriodSelection, string> = {
  TODAY: "Today",
  THIS_WEEK: "This week",
  THIS_MONTH: "This month",
  LAST_MONTH: "Last month",
  THIS_QUARTER: "This quarter",
  THIS_YEAR: "This year",
  LAST_YEAR: "Last year",
  CUSTOM: "Custom range",
};

export interface DateRangeParams {
  startDate: string;
  endDate: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

const toStartDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** End-of-day so the API window includes the whole final day. */
const toEndDate = (d: Date): string => `${toStartDate(d)}T23:59:59`;

/**
 * The current window for a preset, evaluated against `now` (injectable for
 * tests). Weeks start Monday; quarters are calendar quarters.
 */
export function presetRange(preset: ReportPreset, now: Date): DateRangeParams {
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case "TODAY": {
      const today = new Date(year, month, now.getDate());
      return { startDate: toStartDate(today), endDate: toEndDate(today) };
    }
    case "THIS_WEEK": {
      const daysFromMonday = (now.getDay() + 6) % 7;
      const monday = new Date(year, month, now.getDate() - daysFromMonday);
      const sunday = new Date(year, month, now.getDate() - daysFromMonday + 6);
      return { startDate: toStartDate(monday), endDate: toEndDate(sunday) };
    }
    case "THIS_MONTH":
      return {
        startDate: toStartDate(new Date(year, month, 1)),
        endDate: toEndDate(new Date(year, month + 1, 0)),
      };
    case "LAST_MONTH":
      return {
        startDate: toStartDate(new Date(year, month - 1, 1)),
        endDate: toEndDate(new Date(year, month, 0)),
      };
    case "THIS_QUARTER": {
      const quarter = Math.floor(month / 3);
      return {
        startDate: toStartDate(new Date(year, quarter * 3, 1)),
        endDate: toEndDate(new Date(year, (quarter + 1) * 3, 0)),
      };
    }
    case "THIS_YEAR":
      return {
        startDate: toStartDate(new Date(year, 0, 1)),
        endDate: toEndDate(new Date(year, 11, 31)),
      };
    case "LAST_YEAR":
      return {
        startDate: toStartDate(new Date(year - 1, 0, 1)),
        endDate: toEndDate(new Date(year - 1, 11, 31)),
      };
  }
}

/**
 * The API date params for the period control's current state. A custom
 * selection only produces a range once both dates were applied.
 */
export function periodToParams(
  selection: PeriodSelection,
  now: Date,
  customStart?: Date,
  customEnd?: Date,
): Partial<DateRangeParams> {
  if (selection === "CUSTOM") {
    const params: Partial<DateRangeParams> = {};
    if (customStart) params.startDate = toStartDate(customStart);
    if (customEnd) params.endDate = toEndDate(customEnd);
    return params;
  }
  return presetRange(selection, now);
}

/**
 * Filter bars with few controls skip the collapsed Filters button/panel and
 * render their controls inline in the toolbar. With more than this many
 * controls (period included) the collapsed panel earns its place.
 */
export const INLINE_FILTER_THRESHOLD = 2;

/** True when `controlCount` filter controls should render inline. */
export function isInlineFilterBar(controlCount: number): boolean {
  return controlCount <= INLINE_FILTER_THRESHOLD;
}

/**
 * Active-filter badge count: each set entity filter counts, plus the period
 * when it deviates from the default preset.
 */
export function countActiveFilters(
  selection: PeriodSelection,
  entityFilters: Array<string | undefined>,
): number {
  const entityCount = entityFilters.filter(Boolean).length;
  return entityCount + (selection === DEFAULT_PRESET ? 0 : 1);
}
