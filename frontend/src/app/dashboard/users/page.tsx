// src/app/dashboard/users/page.tsx
"use client";
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UsersDataTable } from "@/components/users/table/users-data-table";
import { DataTableSkeleton } from "@/components/ui/DataTableSkeleton";
import { useGetAllUsersQuery } from "@/redux/userApi";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { StaffRole } from "@/types/user.types";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import type { TableFiltersSpec } from "@/hooks/table-query-state-logic";

const STAFF_ROLES = ["ADMIN", "AGENT"] as const;

// A type alias (not interface) so it satisfies the hook's Record constraint.
type IUsersTableFilters = {
  search?: string;
  role?: StaffRole;
};

const FILTERS_SPEC: TableFiltersSpec<IUsersTableFilters> = {
  search: { kind: "string" },
  role: { kind: "enum", values: STAFF_ROLES },
};

const UsersManagePage = () => {
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
  } = useTableQueryState<IUsersTableFilters>({ spec: FILTERS_SPEC });

  const {
    data: usersData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAllUsersQuery(queryParams);

  const users = usersData?.data;

  const handleRefresh = () => refetch();

  if (isLoading && !users) {
    return <DataTableSkeleton />;
  }

  const errorMessage = isError
    ? extractApiErrorMessage(error).message
    : "An Unknown Error Occured!";
  if (isError) {
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
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            Staff Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage staff accounts (admins and agents) and their roles
          </p>
        </div>

        {/* Users Data Table */}
        <UsersDataTable
          toolbarActions={
            <Button
              asChild
              size="sm"
              className="cursor-pointer whitespace-nowrap"
            >
              <Link href="/dashboard/users/create-user">Add Staff</Link>
            </Button>
          }
          data={users || []}
          loading={isLoading}
          totalCount={usersData?.meta.total || 0}
          page={page}
          pageSize={pageSize}
          filters={filters}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onFiltersChange={handleFiltersChange}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  );
};

export default UsersManagePage;
