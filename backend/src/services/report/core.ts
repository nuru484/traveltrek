// src/services/report/core.ts
//
// The one DI'd helper the report modules share: resolving the report year,
// which defaults to the injected clock's current year (so a date filter is
// always applied, exactly like the legacy destructure default).
import { type ReportDeps } from '#services/report/shared.js';

export type ReportCore = ReturnType<typeof makeReportCore>;

export const makeReportCore = (d: ReportDeps) => {
  const { clock } = d;

  const resolveYear = (year?: number): number =>
    year ?? clock.now().getFullYear();

  return { resolveYear };
};
