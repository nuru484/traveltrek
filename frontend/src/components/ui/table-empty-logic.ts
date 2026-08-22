// src/components/ui/table-empty-logic.ts
//
// Pure empty-state semantics shared by the data tables:
//
// - no data AND no active filters/search  -> the page shows ONLY an
//   EmptyState (no filter toolbar, no table headers, no pagination);
// - filters/search active but zero rows   -> the toolbar stays visible and
//   the table body shows a "no matches" EmptyState with a clear action.

/** Which empty rendering (if any) a table should use. */
export type TableEmptyMode = "no-data" | "filtered-empty" | null;

/** True when a filter value would affect the query (mirrors the URL rule). */
export function isMeaningfulFilterValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

/** True when any of the table's filters/search carry a meaningful value. */
export function hasActiveTableFilters(
  filters: Record<string, unknown>
): boolean {
  return Object.values(filters).some(isMeaningfulFilterValue);
}

export function tableEmptyMode(
  loading: boolean,
  rowCount: number,
  filtersActive: boolean
): TableEmptyMode {
  if (loading || rowCount > 0) return null;
  return filtersActive ? "filtered-empty" : "no-data";
}

/** A patch that clears every filter key the table declares. */
export function clearAllFiltersPatch<T extends Record<string, unknown>>(
  filters: T
): { [K in keyof T]: undefined } {
  return Object.fromEntries(
    Object.keys(filters).map((key) => [key, undefined])
  ) as { [K in keyof T]: undefined };
}
