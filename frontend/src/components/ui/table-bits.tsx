// src/components/ui/table-bits.tsx
//
// Building blocks for the dual-render list pattern: below `md` every data
// table renders as a dense, tappable row-card list (all of a row's key data,
// no side-scroll), while `hidden md:block` keeps the real <table> from `md`
// up. Ported from khadys-kitchen's admin table-bits and re-tokenized for this
// design system (border/muted/foreground tokens instead of kk ink colors).
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * The mobile half of a list page. Pair with `hidden md:block` on the table's
 * scroll wrapper; both halves live inside the same bordered container.
 */
export function RowCardList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul role="list" className={cn("md:hidden", className)}>
      {children}
    </ul>
  );
}

/**
 * One row of a RowCardList — a dense, messaging-app-style list row (two short
 * lines, tight padding), not a card. `onOpen` makes the whole row tappable
 * (the card counterpart of a row's "View details" action); `leading` hosts a
 * selection checkbox and `action` an actions menu — both are isolated from
 * the row tap so they never trigger navigation.
 */
export function RowCard({
  onOpen,
  leading,
  action,
  className,
  children,
}: {
  onOpen?: () => void;
  /** Control on the left edge (typically a selection Checkbox). */
  leading?: ReactNode;
  /** Control on the right edge (typically an actions dropdown). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li
      onClick={onOpen}
      className={cn(
        "flex items-center gap-2 border-b border-border py-2.5 transition-colors last:border-0",
        onOpen && "cursor-pointer active:bg-muted/50",
        leading ? "pl-2" : "pl-3",
        action ? "pr-1" : "pr-3",
        className
      )}
    >
      {leading ? (
        <div
          className="flex flex-none items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {leading}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
      {action ? (
        <div className="flex-none" onClick={(e) => e.stopPropagation()}>
          {action}
        </div>
      ) : null}
    </li>
  );
}

/** Compact Badge sizing for dense list rows (pass as its className). */
export const ROW_BADGE = "px-1.5 py-px text-[10px] tracking-[0.04em]";

/** Pulsing placeholder rows — the RowCardList counterpart of table skeletons. */
export function SkeletonRowCards({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <li key={r} className="border-b border-border px-3 py-3 last:border-0">
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </li>
      ))}
    </>
  );
}

/**
 * Filters/search are active but matched nothing (table-empty-logic
 * "filtered-empty"): the toolbar stays, the body offers a clear action.
 * Rendered by BOTH halves of the dual-render pattern (row-card list and the
 * md+ table's spanning cell).
 */
export function FilteredEmpty({
  entityLabel,
  onClear,
}: {
  /** Plural noun for the copy, e.g. "bookings". */
  entityLabel: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      className="py-10"
      eyebrow="No matches"
      title={`No ${entityLabel} match these filters.`}
      description="Try different search or filter criteria."
      action={
        onClear && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="cursor-pointer"
          >
            Clear filters
          </Button>
        )
      }
    />
  );
}

/** Empty state for a RowCardList — mirrors the table's empty row copy. */
export function RowCardEmpty({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <li className="px-4 py-12 text-center">
      <div className="text-muted-foreground">{title}</div>
      {hint ? (
        <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
      ) : null}
    </li>
  );
}
