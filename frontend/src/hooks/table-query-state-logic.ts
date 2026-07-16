// src/hooks/table-query-state-logic.ts
//
// Pure helpers behind useTableQueryState (ported from dms-frontend). Every
// list page used to hand-roll the same URL <-> state plumbing (parse
// searchParams into filters, serialize state back into the URL, strip empty
// values before hitting the API). Centralising the logic here makes it
// unit-testable without rendering a page and keeps each page down to a spec
// object.

/** The primitive value kinds a table filter can hold in the URL. */
export type TableFilterValue = string | number | boolean | undefined;

export type TableFilterFieldSpec =
  | { kind: "string" }
  | { kind: "number" }
  /**
   * `serializeFalse` keeps an explicit `false` in the URL — needed for
   * three-state filters where false and unset mean different things.
   */
  | { kind: "boolean"; serializeFalse?: boolean }
  /** Only values present in `values` survive parsing; garbage in the URL is dropped. */
  | { kind: "enum"; values: readonly string[] };

/**
 * One entry per filter key the page supports. Keys are mandatory in the spec
 * (`-?`) so adding a field to the filters type forces a decision about how it
 * is (de)serialized.
 */
export type TableFiltersSpec<
  TFilters extends Record<string, TableFilterValue>
> = {
  [K in keyof TFilters]-?: TableFilterFieldSpec;
};

/** Minimal read surface shared by URLSearchParams and Next's ReadonlyURLSearchParams. */
export interface ISearchParamsReader {
  get(name: string): string | null;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;

/** Parses a positive integer URL param, falling back on absent/garbage input. */
export const parsePositiveIntParam = (
  raw: string | null,
  fallback: number
): number => {
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseFieldValue = (
  raw: string | null,
  spec: TableFilterFieldSpec
): TableFilterValue => {
  if (raw === null || raw === "") return undefined;

  switch (spec.kind) {
    case "string":
      return raw;
    case "number": {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    case "boolean":
      return raw === "true" ? true : raw === "false" ? false : undefined;
    case "enum":
      return spec.values.includes(raw) ? raw : undefined;
  }
};

/** Reads every declared filter key out of the URL params. */
export const parseFiltersFromParams = <
  TFilters extends Record<string, TableFilterValue>
>(
  params: ISearchParamsReader,
  spec: TableFiltersSpec<TFilters>
): TFilters => {
  const filters = {} as Record<string, TableFilterValue>;
  for (const key of Object.keys(spec)) {
    filters[key] = parseFieldValue(params.get(key), spec[key]);
  }
  return filters as TFilters;
};

/**
 * True when a filter value should appear in the URL / API query: defined,
 * non-empty, and (for strings) not whitespace-only.
 */
export const hasMeaningfulValue = (value: TableFilterValue): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

/**
 * Serializes pagination + filters into URLSearchParams for router.replace.
 * page/limit are always written; filters only when meaningful. `false`
 * booleans are treated as "unset" unless the field opts in via
 * `serializeFalse`.
 */
export const serializeTableState = <
  TFilters extends Record<string, TableFilterValue>
>(
  page: number,
  pageSize: number,
  filters: TFilters,
  spec: TableFiltersSpec<TFilters>
): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("limit", pageSize.toString());

  for (const key of Object.keys(spec)) {
    const fieldSpec = spec[key];
    const value = filters[key];
    if (!hasMeaningfulValue(value)) continue;
    if (
      value === false &&
      !(fieldSpec.kind === "boolean" && fieldSpec.serializeFalse)
    ) {
      continue;
    }
    params.set(key, String(value));
  }

  return params;
};

/** Shallow-compares two filter objects over the spec's keys. */
export const filtersEqual = <
  TFilters extends Record<string, TableFilterValue>
>(
  a: TFilters,
  b: TFilters,
  spec: TableFiltersSpec<TFilters>
): boolean => {
  return Object.keys(spec).every((key) => a[key] === b[key]);
};

/**
 * True when the table sits at its untouched defaults: first page, the default
 * page size and no meaningful filters. Compared through `serializeTableState`
 * so it mirrors exactly what would appear in the URL. Drives the
 * session-memory cleanup: a table at its defaults has nothing to remember.
 */
export const isDefaultTableState = <
  TFilters extends Record<string, TableFilterValue>
>(
  page: number,
  pageSize: number,
  filters: TFilters,
  spec: TableFiltersSpec<TFilters>,
  defaultPageSize: number
): boolean =>
  serializeTableState(page, pageSize, filters, spec).toString() ===
  serializeTableState(
    DEFAULT_PAGE,
    defaultPageSize,
    {} as TFilters,
    spec
  ).toString();

/**
 * Builds the API query params object: page/limit plus only the meaningful
 * filters, so empty strings and undefined never reach the request URL.
 */
export const buildTableQueryParams = <
  TFilters extends Record<string, TableFilterValue>
>(
  page: number,
  limit: number,
  filters: TFilters
): TFilters & { page: number; limit: number } => {
  const cleaned = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => hasMeaningfulValue(value))
  ) as Partial<TFilters>;

  return { page, limit, ...cleaned } as TFilters & {
    page: number;
    limit: number;
  };
};
