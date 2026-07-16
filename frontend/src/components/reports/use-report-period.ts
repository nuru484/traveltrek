// src/components/reports/use-report-period.ts
//
// Shared period-control state for the report tabs: preset selection plus a
// draft/applied custom range (queries only refire on Apply). The pure
// preset → date-range mapping lives in report-filters-logic.ts.
"use client";

import * as React from "react";
import {
  DateRangeParams,
  DEFAULT_PRESET,
  PeriodSelection,
  periodToParams,
} from "./report-filters-logic";

export function useReportPeriod() {
  const [selection, setSelection] =
    React.useState<PeriodSelection>(DEFAULT_PRESET);
  const [customStart, setCustomStart] = React.useState<Date | undefined>();
  const [customEnd, setCustomEnd] = React.useState<Date | undefined>();
  const [appliedStart, setAppliedStart] = React.useState<Date | undefined>();
  const [appliedEnd, setAppliedEnd] = React.useState<Date | undefined>();

  const handleSelectionChange = React.useCallback(
    (value: PeriodSelection) => {
      setSelection(value);
      if (value !== "CUSTOM") {
        setCustomStart(undefined);
        setCustomEnd(undefined);
        setAppliedStart(undefined);
        setAppliedEnd(undefined);
      }
    },
    [],
  );

  const applyCustom = React.useCallback(() => {
    setAppliedStart(customStart);
    setAppliedEnd(customEnd);
  }, [customStart, customEnd]);

  const reset = React.useCallback(() => {
    handleSelectionChange(DEFAULT_PRESET);
  }, [handleSelectionChange]);

  const dateParams: Partial<DateRangeParams> = React.useMemo(
    () => periodToParams(selection, new Date(), appliedStart, appliedEnd),
    [selection, appliedStart, appliedEnd],
  );

  return {
    selection,
    onSelectionChange: handleSelectionChange,
    customStart,
    customEnd,
    onCustomStartChange: setCustomStart,
    onCustomEndChange: setCustomEnd,
    applyCustom,
    reset,
    dateParams,
  };
}

export type ReportPeriodState = ReturnType<typeof useReportPeriod>;
export { DEFAULT_PRESET };
