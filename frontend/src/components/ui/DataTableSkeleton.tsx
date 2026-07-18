// src/components/ui/DataTableSkeleton.tsx
//
// Loading placeholder for the list pages, mirroring the real layout:
// page header, count line, FilterBar (rounded search + pill row), then
// row cards below md and the full table from md up, and pagination.
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableSkeletonProps {
  rows?: number;
}

export function DataTableSkeleton({ rows = 10 }: DataTableSkeletonProps) {
  return (
    <div className="w-full max-w-full space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>

      {/* Count line */}
      <Skeleton className="h-4 w-32" />

      {/* Toolbar: rounded search, then pill + actions row */}
      <div className="space-y-2.5">
        <Skeleton className="h-10 w-full rounded-full @4xl/main:max-w-xs" />
        <div className="flex items-center gap-2.5 @4xl/main:hidden">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="ml-auto h-8 w-28 rounded-md" />
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        {/* Phones: dense row cards. */}
        <ul className="md:hidden">
          {Array.from({ length: Math.min(rows, 8) }).map((_, index) => (
            <li
              key={index}
              className="border-b border-border px-3 py-3 last:border-0"
            >
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-2/5" />
              </div>
            </li>
          ))}
        </ul>

        {/* md and up: the full table. */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableHead key={index}>
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                ))}
                <TableHead className="w-20">
                  <Skeleton className="h-4 w-14" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full max-w-[240px]" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  );
}
