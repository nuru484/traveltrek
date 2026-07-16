// src/components/tours/tour-detail.tsx
//
// Tour detail view: owns the booking/status/delete state and handlers and
// composes the header, description, info grid, booking status and dialogs.
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import {
  useDeleteTourMutation,
  useUpdateTourStatusMutation } from "@/redux/tourApi";
import {
  useGetAllCustomerBookingsQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation } from "@/redux/bookingApi";
import { ITour } from "@/types/tour.types";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FileText } from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import toast from "react-hot-toast";
import { formatMoney } from "@/utils/format-money";
import {
  formatTourDateLong,
  getBookingButtonText,
  getDestinationDisplay,
  isBookingButtonDisabled } from "./tour-detail-logic";
import { TourDetailHeader } from "./tour-detail-header";
import { TourInfoGrid } from "./tour-info-grid";
import { TourBookingStatus } from "./tour-booking-status";

interface ITourDetailProps {
  tour: ITour;
}

export function TourDetail({ tour }: ITourDetailProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";
  const isAgent = user?.role === "AGENT";
  const canUpdateStatus = isAdmin;

  const [deleteTour, { isLoading: isDeleting }] = useDeleteTourMutation();
  const [updateTourStatus, { isLoading: isUpdatingStatus }] =
    useUpdateTourStatusMutation();
  const [createBooking, { isLoading: isBooking }] = useCreateBookingMutation();
  const [updateBooking, { isLoading: isCancelling }] =
    useUpdateBookingMutation();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
    isFetching: isFetchingBookings,
    isError: isBookingsError,
    error: bookingsError } = useGetAllCustomerBookingsQuery(
    { customerId: Number(user?.id), params: { page: 1, limit: 1000 } },
    {
      // Customer-only: staff have no booking history of their own.
      skip: !user || isAdmin || isAgent,
      refetchOnMountOrArgChange: 30 }
  );

  useEffect(() => {
    if (isBookingsError) {
      const { message } = extractApiErrorMessage(bookingsError);
      toast.error(message || "Failed to load bookings");
    }
  }, [isBookingsError, bookingsError]);

  const userBooking = bookingsData?.data.find(
    (booking) =>
      booking.tour?.id === tour.id && booking.customerId === Number(user?.id)
  );

  const bookingStatus = userBooking?.status;
  const isTourBooked = !!userBooking;
  const isBookingActive =
    isTourBooked &&
    bookingStatus !== "CANCELLED" &&
    bookingStatus !== "COMPLETED";
  const isFullyBooked = tour.guestsBooked >= tour.maxGuests;
  const isBookingDataLoading = isLoadingBookings || isFetchingBookings;

  const isLoading = isDeleting || isBooking || isCancelling || isUpdatingStatus;

  const bookingFlags = {
    isBookingDataLoading,
    isTourBooked,
    isFullyBooked,
    bookingStatus };
  const bookingButtonText = getBookingButtonText(bookingFlags);
  const bookingButtonDisabled = isBookingButtonDisabled({
    ...bookingFlags,
    isBooking,
    isCancelling,
    tourStatus: tour.status });

  const handleStatusChange = async (newStatus: string) => {
    const toastId = toast.loading(`Updating tour status to ${newStatus}...`);

    try {
      await updateTourStatus({
        id: tour.id,
        status: newStatus }).unwrap();

      toast.dismiss(toastId);
      toast.success(`Tour status updated to ${newStatus} successfully`);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to update tour status");
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/tours/${tour.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteTour(tour.id).unwrap();
      toast.success("Tour deleted successfully");
      setShowDeleteDialog(false);
      router.push("/dashboard/tours");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.error(message || "Failed to delete tour");
    }
  };

  const handleBook = async () => {
    if (!user) {
      toast.error("Please log in to book a tour");
      router.push("/login");
      return;
    }

    try {
      await createBooking({
        customerId: Number(user.id),
        tourId: tour.id,
        totalPrice: tour.price }).unwrap();
      toast.success("Tour booked successfully");
      setShowBookDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.error(message || "Failed to book tour");
    }
  };

  const handleCancelBooking = async () => {
    if (!userBooking) return;

    const toastId = toast.loading("Cancelling booking...");

    try {
      await updateBooking({
        bookingId: userBooking.id,
        data: { status: "CANCELLED" } }).unwrap();

      toast.dismiss(toastId);
      toast.success("Booking cancelled successfully");
      setShowCancelDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to cancel booking");
      setShowCancelDialog(false);
    }
  };

  const handleBookingButtonClick = () => {
    if (isBookingDataLoading) {
      return;
    }

    if (!isTourBooked) {
      setShowBookDialog(true);
    } else if (isBookingActive) {
      setShowCancelDialog(true);
    }
  };

  const truncatedTourName =
    tour.name.length > 50 ? `${tour.name.slice(0, 47)}...` : tour.name;

  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6">
        <TourDetailHeader
          tour={tour}
          isAdmin={isAdmin}
          isAgent={isAgent}
          canUpdateStatus={canUpdateStatus}
          isLoading={isLoading}
          isFullyBooked={isFullyBooked}
          isBookingDataLoading={isBookingDataLoading}
          isTourBooked={isTourBooked}
          isBookingActive={isBookingActive}
          bookingStatus={bookingStatus}
          bookingButtonText={bookingButtonText}
          bookingButtonDisabled={bookingButtonDisabled}
          onBookingButtonClick={handleBookingButtonClick}
          onStatusChange={handleStatusChange}
          onEdit={handleEdit}
          onDeleteClick={() => setShowDeleteDialog(true)}
        />

        {/* Content Section */}
        <Card className="py-0 max-sm:rounded-none max-sm:border-x-0 max-sm:bg-transparent">
          <CardContent className="p-4 sm:p-6 max-sm:px-3">
            <div className="space-y-6">
              {/* Description Section */}
              {tour.description && (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-foreground">
                        About This Tour
                      </h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
                      {tour.description}
                    </p>
                  </div>

                  <Separator />
                </>
              )}

              {/* Quick Info Grid */}
              <TourInfoGrid tour={tour} isFullyBooked={isFullyBooked} />

              {/* Booking Status Section for Users */}
              {!isAdmin && !isAgent && (
                <>
                  <Separator />
                  <TourBookingStatus
                    tour={tour}
                    isBookingDataLoading={isBookingDataLoading}
                    isTourBooked={isTourBooked}
                    isBookingActive={isBookingActive}
                    bookingStatus={bookingStatus}
                    isFullyBooked={isFullyBooked}
                    isBooking={isBooking}
                    isCancelling={isCancelling}
                    bookingButtonText={bookingButtonText}
                    bookingButtonDisabled={bookingButtonDisabled}
                    onBookingButtonClick={handleBookingButtonClick}
                  />
                </>
              )}

              {/* Metadata Footer */}
              {tour.createdAt && (
                <div className="pt-4 border-t">
                  <div className="flex flex-col gap-3 text-xs text-muted-foreground min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:gap-4">
                    <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-1.5">
                      <span className="font-medium">Created:</span>
                      <span>{formatTourDateLong(tour.createdAt)}</span>
                    </div>
                    {tour.updatedAt && tour.createdAt !== tour.updatedAt && (
                      <>
                        <span className="max-[479px]:hidden">•</span>
                        <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-1.5">
                          <span className="font-medium">Last updated:</span>
                          <span>{formatTourDateLong(tour.updatedAt)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialogs */}
        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Tour"
          description={`Are you sure you want to delete "${truncatedTourName}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />

        <ConfirmationDialog
          open={showBookDialog}
          onOpenChange={setShowBookDialog}
          title="Confirm Booking"
          description={`Are you sure youwant to book "${truncatedTourName}" to ${getDestinationDisplay(tour.destination)} for ${formatMoney(tour.price, { exact: true })}?`}
          onConfirm={handleBook}
          confirmText="Book Now"
        />

        <ConfirmationDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          title="Cancel Booking"
          description={`Are you sure you want to cancel your booking for "${truncatedTourName}"? This will update your booking status to CANCELLED.`}
          onConfirm={handleCancelBooking}
          confirmText="Cancel Booking"
          isDestructive
        />
      </div>
    </TooltipProvider>
  );
}
