"use client";
import { useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { TourList } from "@/components/tours/tour-list";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useDeleteAllToursMutation,
  useGetAllToursQuery,
} from "@/redux/tourApi";
import toast from "react-hot-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { IToursQueryParams } from "@/types/tour.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

export default function AdminToursPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isAdmin = user?.role === "ADMIN" || user?.role === "AGENT";

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

  const [deleteAllTours, { isLoading: isDeletingAll }] =
    useDeleteAllToursMutation();

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

  const handleDeleteAllTours = async () => {
    const toastId = toast.loading("Deleting tours...");

    try {
      await deleteAllTours().unwrap();
      toast.dismiss(toastId);
      toast.success("All tours deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete all tours:", error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to delete all tours");
    }
  };

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Tours</CardTitle>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateTour}
              className="flex-1 sm:flex-none hover:text-foreground cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4 hidden sm:inline-block" />
              <span className="text-xs sm:text-sm">Create Tour</span>
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

      <TourList
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

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete All Tours"
        description="Are you sure you want to delete all tours? This action cannot be undone."
        onConfirm={handleDeleteAllTours}
        confirmText="Delete"
        requireExactMatch="Delete All Tours"
        isDestructive
      />
    </div>
  );
}
