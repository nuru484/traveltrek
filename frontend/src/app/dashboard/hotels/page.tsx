"use client";
import { useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { HotelList } from "@/components/hotels/hotel-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useRouter } from "next/navigation";
import { useGetAllHotelsQuery } from "@/redux/hotelApi";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import { IHotelQueryParams } from "@/types/hotel.types";

export default function HotelsPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<
    Omit<IHotelQueryParams, "page" | "limit">
  >({
    search: undefined,
    destinationId: undefined,
    city: undefined,
    country: undefined,
    minStarRating: undefined,
  });

  const queryParams: IHotelQueryParams = {
    page,
    limit,
    ...Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined)
    ),
  };

  const {
    data: hotelsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAllHotelsQuery(queryParams);

  const { data: destinationsData } = useGetAllDestinationsQuery({
    limit: 100,
  });

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

  const handleCreateHotels = () => {
    router.push("/dashboard/hotels/create");
  };

  return (
    <div className="container mx-auto space-y-6">
      <PageHeader
        title="Hotels"
        description="Manage hotels and their room inventory."
      />

      <HotelList
        toolbarActions={
          isAdmin ? (
            <Button
              size="sm"
              onClick={handleCreateHotels}
              className="cursor-pointer whitespace-nowrap"
            >
              Create Hotel
            </Button>
          ) : undefined
        }
        data={hotelsData?.data || []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        meta={
          hotelsData?.meta || {
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
        destinations={destinationsData?.data || []}
      />
    </div>
  );
}
