// src/app/dashboard/customers/page.tsx
"use client";
import React from "react";
import Link from "next/link";
import { CustomersDataTable } from "@/components/customers/table/customers-data-table";
import { DataTableSkeleton } from "@/components/ui/DataTableSkeleton";
import { useGetAllCustomersQuery } from "@/redux/customerApi";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import type { TableFiltersSpec } from "@/hooks/table-query-state-logic";

// A type alias (not interface) so it satisfies the hook's Record constraint.
type ICustomersTableFilters = {
  search?: string;
};

const FILTERS_SPEC: TableFiltersSpec<ICustomersTableFilters> = {
  search: { kind: "string" },
};

const CustomersManagePage = () => {
  // URL + session table state: deep links win, and navigating to a detail
  // and back restores the page/filters you left.
  const {
    page,
    pageSize,
    filters,
    queryParams,
    handlePageChange,
    handlePageSizeChange,
    handleFiltersChange,
  } = useTableQueryState<ICustomersTableFilters>({ spec: FILTERS_SPEC });

  const {
    data: customersData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAllCustomersQuery(queryParams);

  const customers = customersData?.data;

  if (isLoading && !customers) {
    return <DataTableSkeleton />;
  }

  if (isError) {
    const errorMessage = extractApiErrorMessage(error).message;
    return (
      <div className="flex items-center justify-center min-h-96">
        <ErrorMessage error={errorMessage} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl py-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">
              Customers
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage the customer base — profiles, bookings and payments
            </p>
          </div>

          <Link
            href="/dashboard/customers/create"
            className="px-3 py-2 sm:px-4 sm:py-2 bg-foreground text-background rounded-md cursor-pointer transition-colors duration-200 hover:bg-foreground/90 text-sm sm:text-base font-medium text-center whitespace-nowrap flex-shrink-0"
          >
            Add Customer
          </Link>
        </div>

        <CustomersDataTable
          data={customers || []}
          loading={isLoading}
          totalCount={customersData?.meta.total || 0}
          page={page}
          pageSize={pageSize}
          filters={filters}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onFiltersChange={handleFiltersChange}
          onRefresh={refetch}
        />
      </div>
    </div>
  );
};

export default CustomersManagePage;
