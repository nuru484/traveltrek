// src/components/ui/data-table.tsx
//
// The ONE list-table scaffold. Every entity data table (bookings, payments,
// customers, staff) shares the same orchestration: tanstack table setup, the
// dual render (dense row cards below md, the real table from md up), the
// empty-state semantics, loading skeletons, and pagination. It lives here
// once; entity files keep only what is truly theirs - columns, the row-card
// content, the toolbar, and delete flows.
//
// Split into a hook + a shell so entity code OWNS the table instance: the
// toolbar (column toggles, selection count) and delete flows need it, and
// threading callbacks out of a monolithic component is worse than handing
// the instance in.
"use client";
import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  Table as TanstackTable,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import {
  FilteredEmpty,
  RowCardList,
  SkeletonRowCards,
} from "@/components/ui/table-bits";
import {
  hasActiveTableFilters,
  tableEmptyMode,
} from "@/components/ui/table-empty-logic";

/** The standard server-paginated table instance every entity table uses. */
export function useDataTable<TData>({
  columns,
  data,
  pageSize,
  totalCount,
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  pageSize: number;
  totalCount: number;
}): TanstackTable<TData> {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  return useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    manualPagination: true,
    manualFiltering: true,
    pageCount: Math.ceil(totalCount / pageSize),
  });
}

interface DataTableProps<TData> {
  table: TanstackTable<TData>;
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** The table's active query filters - drives the empty-state semantics. */
  filters: Record<string, unknown>;
  /** Clears every filter (the filtered-empty state's escape hatch). */
  onClearFilters: () => void;
  /** Plural label used in the filtered-empty copy, e.g. "bookings". */
  entityLabel: string;
  /** Copy for the full-page EmptyState when no rows exist unfiltered. */
  noData: { description: string; title: string };
  /**
   * Rendered INSTEAD of everything else whenever the table is empty (even
   * with filters active) - e.g. a profile's "no recent activity" card.
   */
  emptyOverride?: React.ReactNode;
  /** The entity's filter toolbar; omit to hide it. */
  toolbar?: React.ReactNode;
  /** One dense RowCard per row (the below-md rendering). */
  renderRowCard: (row: Row<TData>) => React.ReactNode;
  showPagination?: boolean;
}

/**
 * Dual-render list body: row cards below md, the real table from md up, with
 * the shared empty-state semantics (no data + no filters gives a lone
 * EmptyState; a filtered miss keeps the toolbar and offers a clear action).
 */
export function DataTable<TData>({
  table,
  loading,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  filters,
  onClearFilters,
  entityLabel,
  noData,
  emptyOverride,
  toolbar,
  renderRowCard,
  showPagination = true,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const hasData = !loading && rows.length > 0;
  const columnCount = table.getAllLeafColumns().length;

  if (!loading && rows.length === 0 && emptyOverride) {
    return <div className="w-full max-w-full">{emptyOverride}</div>;
  }

  const emptyMode = tableEmptyMode(
    loading,
    rows.length,
    hasActiveTableFilters(filters)
  );

  if (emptyMode === "no-data") {
    return (
      <div className="w-full max-w-full">
        <EmptyState
          className="rounded-lg border border-foreground/15"
          title={noData.title}
          description={noData.description}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-6">
      {toolbar}

      {/* Dual render: row cards below md, the real table from md up. */}
      <div className="rounded-md border overflow-hidden">
        {/* Phones: dense tappable row cards - no side-scroll. */}
        <RowCardList>
          {loading ? (
            <SkeletonRowCards rows={Math.min(pageSize, 8)} />
          ) : hasData ? (
            rows.map((row) => (
              <React.Fragment key={row.id}>{renderRowCard(row)}</React.Fragment>
            ))
          ) : (
            <li>
              <FilteredEmpty
                entityLabel={entityLabel}
                onClear={onClearFilters}
              />
            </li>
          )}
        </RowCardList>

        {/* From md up: the full table. */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${String(rowIndex)}`}>
                    {Array.from({ length: columnCount }).map((_, cellIndex) => (
                      <TableCell key={`skeleton-cell-${String(cellIndex)}`}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : hasData ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columnCount}>
                    <FilteredEmpty
                      entityLabel={entityLabel}
                      onClear={onClearFilters}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {showPagination && (
        <DataTablePagination
          table={table}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
