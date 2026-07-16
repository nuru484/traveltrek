// src/hooks/use-table-query-state.ts
//
// URL + session table state (ported from dms-frontend). Owns a list page's
// page/pageSize/filters so links are shareable, ?status= deep links keep
// working, and navigating to a detail and back restores where you left off.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  buildTableQueryParams,
  filtersEqual,
  isDefaultTableState,
  parseFiltersFromParams,
  parsePositiveIntParam,
  serializeTableState,
  type ISearchParamsReader,
  type TableFilterValue,
  type TableFiltersSpec,
} from "@/hooks/table-query-state-logic";

export interface IUseTableQueryStateOptions<
  TFilters extends Record<string, TableFilterValue>
> {
  /** Declares every filter key the page supports and how it (de)serializes. */
  spec: TableFiltersSpec<TFilters>;
  defaultPageSize?: number;
  /**
   * Namespaces this table's URL params and session-memory key when several
   * tables share a pathname: `page` becomes `<prefix>_page` and only the
   * prefixed params are read/written, so two tables never clobber each other.
   */
  prefix?: string;
  /** Applied after every parse/patch to enforce cross-field rules. */
  normalizeFilters?: (filters: TFilters) => TFilters;
  /** Smooth-scroll to the top on page change (the list-page default). */
  scrollToTopOnPageChange?: boolean;
}

/**
 * Owns a list page's URL-synced table state: page, pageSize and typed filters.
 *
 * - initial state parsed from the URL (shareable/refresh-safe links; the URL
 *   params are the source of truth on load, so ?status= deep links win)
 * - state -> URL sync via router.replace (no history spam, no scroll jump)
 * - URL -> state sync for external navigation (e.g. a tile pushing params)
 * - page reset on filter/pageSize change, scroll-to-top on page change
 * - `queryParams` with empty values stripped, ready for the RTK Query hook
 * - session memory: re-entering the list through the nav (a bare URL, no
 *   table params) restores where you left it; an explicit URL always wins
 *   and a fresh browser session starts clean
 */
export const useTableQueryState = <
  TFilters extends Record<string, TableFilterValue>
>({
  spec,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  prefix,
  normalizeFilters,
  scrollToTopOnPageChange = true,
}: IUseTableQueryStateOptions<TFilters>) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const normalize = useCallback(
    (filters: TFilters): TFilters =>
      normalizeFilters ? normalizeFilters(filters) : filters,
    // The normalizer is a pure cross-field rule; treat it as stable so an
    // inline arrow at the call site doesn't re-fire the URL-sync effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** This table's URL name for a param (`page` -> `<prefix>_page` etc.). */
  const paramName = useCallback(
    (name: string) => (prefix ? `${prefix}_${name}` : name),
    [prefix]
  );
  /** Reads a params object through this table's (possibly prefixed) names. */
  const ownParams = useCallback(
    (params: ISearchParamsReader): ISearchParamsReader => ({
      get: (name) => params.get(paramName(name)),
    }),
    [paramName]
  );

  const [page, setPage] = useState<number>(() =>
    parsePositiveIntParam(searchParams.get(paramName("page")), DEFAULT_PAGE)
  );
  const [pageSize, setPageSize] = useState<number>(() =>
    parsePositiveIntParam(searchParams.get(paramName("limit")), defaultPageSize)
  );
  const [filters, setFilters] = useState<TFilters>(() =>
    normalize(parseFiltersFromParams(ownParams(searchParams), spec))
  );

  /**
   * Session memory: when the page mounts with a bare URL (no table params —
   * e.g. re-entered through the sidebar), restore the state saved for this
   * pathname earlier in the browser session. Runs in a mount effect, never a
   * useState initializer, because SSR/prerender has no sessionStorage. An
   * explicit URL always wins, and sessionStorage's lifetime means a fresh
   * session starts clean. `pendingRestoreRef` holds the restored state's
   * serialized form until the write effect below has caught up, so the
   * pre-restore defaults never clobber it (see both effects' guards).
   */
  const storageKey = `traveltrek-table:${pathname}${prefix ? `:${prefix}` : ""}`;
  const pendingRestoreRef = useRef<string | null>(null);
  const restoreCheckedRef = useRef(false);
  useEffect(() => {
    if (restoreCheckedRef.current) return;
    restoreCheckedRef.current = true;
    const hasExplicitParams = ["page", "limit", ...Object.keys(spec)].some(
      (name) => searchParams.get(paramName(name)) !== null
    );
    if (hasExplicitParams) return;
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;
    const savedParams = new URLSearchParams(saved);
    const savedPage = parsePositiveIntParam(
      savedParams.get("page"),
      DEFAULT_PAGE
    );
    const savedPageSize = parsePositiveIntParam(
      savedParams.get("limit"),
      defaultPageSize
    );
    const savedFilters = normalize(parseFiltersFromParams(savedParams, spec));
    pendingRestoreRef.current = serializeTableState(
      savedPage,
      savedPageSize,
      savedFilters,
      spec
    ).toString();
    // Synchronizing with an external system (sessionStorage) that can't be
    // read during SSR/prerender - the mount effect is the earliest safe spot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(savedPage);
    setPageSize(savedPageSize);
    setFilters(savedFilters);
    // Mount-only: the bare-URL check and saved state are only meaningful once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * URL -> state sync. Picks up changes made outside this hook (e.g. a
   * router.push from inside the table). Equality-guarded so it doesn't
   * loop with the write effect below.
   */
  useEffect(() => {
    // A session restore is still propagating; don't reset it to the bare URL.
    if (pendingRestoreRef.current !== null) return;
    const params = ownParams(searchParams);
    const urlFilters = normalize(parseFiltersFromParams(params, spec));
    const urlPage = parsePositiveIntParam(params.get("page"), DEFAULT_PAGE);
    const urlPageSize = parsePositiveIntParam(
      params.get("limit"),
      defaultPageSize
    );

    setFilters((prev) =>
      filtersEqual(urlFilters, prev, spec) ? prev : urlFilters
    );
    setPage((prev) => (urlPage === prev ? prev : urlPage));
    setPageSize((prev) => (urlPageSize === prev ? prev : urlPageSize));
    // Intentionally reacting to URL changes only; including state here would
    // re-fire on every UI change and race with the write effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** State -> URL sync: persist UI-driven changes without history entries. */
  useEffect(() => {
    const own = serializeTableState(page, pageSize, filters, spec);
    const serialized = own.toString();
    if (pendingRestoreRef.current !== null) {
      // The mount run still sees the pre-restore defaults; skip it so they
      // never overwrite the restored state, then resume once state caught up.
      if (serialized !== pendingRestoreRef.current) return;
      pendingRestoreRef.current = null;
    }

    // Merge into the *live* URL so params that aren't ours — e.g. another
    // table's prefixed state or a ?customerId= drill-down — survive, and only
    // navigate when the URL actually changes (no redundant replaces).
    const params = new URLSearchParams(window.location.search);
    for (const name of ["page", "limit", ...Object.keys(spec)]) {
      params.delete(paramName(name));
    }
    own.forEach((value, name) => params.set(paramName(name), value));
    const target = `${pathname}?${params.toString()}`;
    if (target !== `${window.location.pathname}${window.location.search}`) {
      router.replace(target, { scroll: false });
    }

    // Session memory (mirror of the restore above): remember this table's
    // non-default state; forget it once everything is back at the defaults.
    if (isDefaultTableState(page, pageSize, filters, spec, defaultPageSize)) {
      sessionStorage.removeItem(storageKey);
    } else {
      sessionStorage.setItem(storageKey, serialized);
    }
    // `spec` is a static literal at every call site; depending on it would
    // re-fire the effect each render for pages that declare it inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    pageSize,
    filters,
    router,
    pathname,
    defaultPageSize,
    storageKey,
    paramName,
  ]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      if (scrollToTopOnPageChange) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [scrollToTopOnPageChange]
  );

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  const handleFiltersChange = useCallback(
    (patch: Partial<TFilters>) => {
      setFilters((prev) => normalize({ ...prev, ...patch }));
      setPage(1);
    },
    [normalize]
  );

  return {
    page,
    pageSize,
    filters,
    /** page/limit plus only the meaningful filters — pass straight to the query hook. */
    queryParams: buildTableQueryParams(page, pageSize, filters),
    handlePageChange,
    handlePageSizeChange,
    handleFiltersChange,
  };
};
