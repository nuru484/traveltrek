"use client";
import { useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { HotelList } from "@/components/hotels/hotel-list";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useDeleteAllHotelsMutation,
  useGetAllHotelsQuery,
} from "@/redux/hotelApi";
import { useGetAllDestinationsQuery } from "@/redux/destinationApi";
import toast from "react-hot-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { IHotelQueryParams } from "@/types/hotel.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

export default function HotelsPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isAdmin = user?.role === "ADMIN" || user?.role === "AGENT";

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

  const [deleteAllHotels, { isLoading: isDeletingAll }] =
    useDeleteAllHotelsMutation();

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

  const handleDeleteAllHotels = async () => {
    try {
      await deleteAllHotels().unwrap();
      toast.success("All hotels deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete all hotels:", error);
      toast.error(message || "Failed to delete all hotels");
    }
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Hotels</CardTitle>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateHotels}
              className="flex-1 sm:flex-none hover:text-foreground cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4 hidden sm:inline-block" />
              <span className="text-xs sm:text-sm">Create Hotel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeletingAll}
              className="flex-1 sm:flex-none text-destructive hover:text-destructive cursor-pointer"
            >
              <span className="text-xs sm:text-sm">Delete All</span>
            </Button>
          </div>
        )}
      </div>

      <HotelList
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

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete All Hotels"
        description="Are you sure you want to delete all hotels? This action cannot be undone."
        onConfirm={handleDeleteAllHotels}
        confirmText="Delete"
        requireExactMatch="Delete All Hotels"
        isDestructive
      />
    </div>
  );
}
