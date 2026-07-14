// src/components/ui/Pagination.tsx
"use client";

import React from "react";

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  showPageSizeSelector?: boolean;
  pageSizeOptions?: number[];
  className?: string;
}

/**
 * Minimal pagination in the landing's document voice: previous / next and a
 * mono page indicator — no page-number rail, no size selector.
 */
const Pagination: React.FC<PaginationProps> = ({
  meta,
  onPageChange,
  className = "",
}) => {
  const { page: currentPage, totalPages } = meta;

  const buttonClass =
    "cursor-pointer rounded-full border border-foreground/20 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      className={`flex items-center justify-between gap-3 py-4 ${className}`}
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={buttonClass}
      >
        Previous
      </button>

      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={buttonClass}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
