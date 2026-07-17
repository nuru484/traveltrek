// src/utils/active-filters.ts
//
// Shared "is any filter set?" check for the dashboard list surfaces. Callers
// pass their filters object WITHOUT pagination keys (page/limit) and WITHOUT
// sort defaults (destructure sortBy/sortOrder off first where the shape
// carries them) — those are view state, not filters, and must not force the
// filter bar onto a truly empty list.

/** True when any filter value is meaningfully set (page/limit excluded by the caller's filter shape). */
export const hasActiveFilterValues = (filters: object): boolean =>
  Object.values(filters).some((v) => v !== undefined && v !== null && v !== "");
