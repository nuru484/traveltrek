// src/components/ui/FilterBar.tsx
"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Shared list toolbar, mobile-first (mirrors khadys-kitchen's FilterBar):
 *
 * - Narrow containers (phones, and tablets with the sidebar open): the
 *   search is always visible and spans the full width; beneath it a Filters
 *   toggle-pill sits on the left with the page actions on the right. The
 *   filter controls live behind the toggle in a two-column panel.
 * - Wide containers (@4xl/main up): the search sits inline with the filter
 *   controls on one row; actions align to the right.
 */
export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  activeCount = 0,
  onClear,
  actions,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  /** Number of active filters — shown as a badge on the Filters pill. */
  activeCount?: number;
  /** Resets every filter; renders a "Clear filters" link when any is active. */
  onClear?: () => void;
  /** Page actions (e.g. Create / Delete all) — right-aligned on every size. */
  actions?: ReactNode;
  /** The filter controls (selects). */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const clearLink =
    onClear && activeCount > 0 ? (
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer whitespace-nowrap text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        Clear filters
      </button>
    ) : null;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Search — full width until the container can fit the inline row */}
      <div className="relative w-full @4xl/main:min-w-[200px] @4xl/main:max-w-xs">
        <Search
          className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-10 rounded-full pl-10 pr-9"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Narrow row 2 (phones + tablets with the sidebar open): Filters pill left, actions right */}
      <div className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-2 @4xl/main:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="filter-bar-panel"
          className="inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 active:bg-muted"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="grid h-4.5 min-w-[18px] place-items-center rounded-full bg-foreground px-1 font-mono text-[10px] font-medium text-background">
              {activeCount}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {!open ? clearLink : null}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      </div>

      {/* Wide containers: filters inline after the search */}
      <div className="hidden @4xl/main:flex @4xl/main:flex-wrap @4xl/main:items-center @4xl/main:gap-2">
        {children}
        {clearLink}
      </div>
      {actions ? (
        <div className="hidden @4xl/main:ml-auto @4xl/main:flex @4xl/main:items-center @4xl/main:gap-2">
          {actions}
        </div>
      ) : null}

      {/* Phone panel: two columns, every control full width */}
      {open ? (
        <div
          id="filter-bar-panel"
          className="grid w-full grid-cols-2 gap-2 @4xl/main:hidden [&_[data-slot=select-trigger]]:w-full"
        >
          {children}
          {clearLink ? (
            <div className="col-span-full pt-1">{clearLink}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
