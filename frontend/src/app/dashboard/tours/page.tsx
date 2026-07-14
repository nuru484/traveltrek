"use client";
import { useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { TourList } from "@/components/tours/tour-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useRouter } from "next/navigation";
import { useGetAllToursQuery } from "@/redux/tourApi";
import { IToursQueryParams } from "@/types/tour.types";

export default function AdminToursPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<
    Omit<IToursQueryParams, "page" | "limit">
  >({
    search: undefined,
    type: undefined,
    status: undefined,
    location: undefined,
  });

  // Build query parameters
  const queryParams: IToursQueryParams = {
    page,
    limit,
    ...Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined)
    ),
  };

  const {
    data: toursData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAllToursQuery(queryParams);

  const handlePageChange = (newPage: number) => setPage(newPage);

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleFiltersChange = useCallback(
    (newFilters: Partial<typeof filters>) => {
      setFilters((prev) => ({
        ...prev,
        ...newFilters,
      }));
      setPage(1);
    },
    []
  );

  const handleCreateTour = () => {
    router.push("/dashboard/tours/create");
  };

  return (
    <div className="container mx-auto space-y-6">
      <PageHeader
        title="Tours"
        description="Curate and manage tour packages."
      />

      <TourList
        toolbarActions={
          isAdmin ? (
            <Button
              size="sm"
              onClick={handleCreateTour}
              className="cursor-pointer whitespace-nowrap"
            >
              Create Tour
            </Button>
          ) : undefined
        }
        data={toursData?.data || []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={
          toursData?.meta || {
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
          }
        }
        filters={filters}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        onFiltersChange={handleFiltersChange}
        onRefetch={refetch}
      />
    </div>
  );
}
