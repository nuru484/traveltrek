// src/components/ui/DataTablePagination.tsx
"use client";
import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

interface ITablePaginationProps<TData> {
  table?: Table<TData>;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

/**
 * Minimal pagination in the landing's document voice: previous / next and a
 * mono page indicator — nothing else.
 */
export function DataTablePagination<TData>({
  totalCount,
  page,
  pageSize,
  onPageChange,
}: ITablePaginationProps<TData>) {
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange?.(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="cursor-pointer"
      >
        Previous
      </Button>

      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Page {page} of {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange?.(page + 1)}
        disabled={page >= totalPages}
        className="cursor-pointer"
      >
        Next
      </Button>
    </div>
  );
}
