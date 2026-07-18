// src/components/flights/flight-detail.tsx
//
// Flight detail view: owns the booking/status/delete state and handlers and
// composes the hero, route cards, availability, schedule and dialogs.
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { RootState } from "@/redux/store";
import {
  useDeleteFlightMutation,
  useUpdateFlightStatusMutation } from "@/redux/flightApi";
import {
  useGetAllCustomerBookingsQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation } from "@/redux/bookingApi";
import { IFlight } from "@/types/flight.types";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MapPin, CreditCard } from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import toast from "react-hot-toast";
import { Money } from "@/components/ui/Money";
import { formatMoney } from "@/utils/format-money";
import {
  formatFlightDuration,
  getDestinationDisplayName,
  validateDelaySchedule } from "./flight-detail-logic";
import { FlightDetailHero } from "./flight-detail-hero";
import { FlightAvailabilityCard } from "./flight-availability-card";
import { FlightScheduleCard } from "./flight-schedule-card";
import { FlightDelayDialog } from "./flight-delay-dialog";

interface IFlightDetailProps {
  flight: IFlight;
}

export function FlightDetail({ flight }: IFlightDetailProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";
  const isAgent = user?.role === "AGENT";
  const canUpdateStatus = isAdmin;

  const [deleteFlight, { isLoading: isDeleting }] = useDeleteFlightMutation();
  const [updateFlightStatus, { isLoading: isUpdatingStatus }] =
    useUpdateFlightStatusMutation();
  const [createBooking, { isLoading: isBooking }] = useCreateBookingMutation();
  const [updateBooking, { isLoading: isCancelling }] =
    useUpdateBookingMutation();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Delayed status modal state
  const [showDelayedModal, setShowDelayedModal] = useState(false);
  const [newDeparture, setNewDeparture] = useState<Date | undefined>();
  const [newArrival, setNewArrival] = useState<Date | undefined>();
  const [isUpdatingDelayed, setIsUpdatingDelayed] = useState(false);
  const [selectedDelayedStatus, setSelectedDelayedStatus] =
    useState<string>("");

  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
    isFetching: isFetchingBookings } = useGetAllCustomerBookingsQuery(
    { customerId: Number(user?.id), params: { page: 1, limit: 100 } },
    {
      // Customer-only: staff have no booking history of their own.
      skip: !user || isAdmin || isAgent,
      refetchOnMountOrArgChange: 30 }
  );

  const userBooking = bookingsData?.data.find(
    (booking) =>
      booking.flight?.id === flight.id &&
      booking.customerId === Number(user?.id)
  );

  const bookingStatus = userBooking?.status;
  const isFlightBooked = !!userBooking;
  const isBookingActive =
    isFlightBooked &&
    bookingStatus !== "CANCELLED" &&
    bookingStatus !== "COMPLETED";

  const isBookingDataLoading = isLoadingBookings || isFetchingBookings;
  const isAvailable = flight.seatsAvailable > 0;

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "DELAYED") {
      setSelectedDelayedStatus(newStatus);
      setNewDeparture(undefined);
      setNewArrival(undefined);
      setShowDelayedModal(true);
      return;
    }

    const toastId = toast.loading(`Updating flight status to ${newStatus}...`);

    try {
      await updateFlightStatus({
        id: flight.id,
        status: newStatus }).unwrap();

      toast.dismiss(toastId);
      toast.success(`Flight status updated to ${newStatus} successfully`);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to update flight status");
    }
  };

  const handleDelayedStatusUpdate = async () => {
    const validation = validateDelaySchedule(
      newDeparture,
      newArrival,
      new Date(flight.departure)
    );
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

    setIsUpdatingDelayed(true);
    const toastId = toast.loading("Updating flight with new schedule...");

    try {
      await updateFlightStatus({
        id: flight.id,
        status: selectedDelayedStatus,
        departure: newDeparture!.toISOString(),
        arrival: newArrival!.toISOString() }).unwrap();

      toast.dismiss(toastId);
      toast.success("Flight delayed status updated successfully");
      setShowDelayedModal(false);
      setNewDeparture(undefined);
      setNewArrival(undefined);
      setIsUpdatingDelayed(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to update delayed status");
      setIsUpdatingDelayed(false);
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/flights/${flight.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteFlight(flight.id).unwrap();
      toast.success("Flight deleted successfully");
      setShowDeleteDialog(false);
      router.push("/dashboard/flights");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.error(message || "Failed to delete flight");
    }
  };

  const handleBook = async () => {
    if (!user) {
      toast.error("Please log in to book a flight");
      router.push("/login");
      return;
    }

    try {
      await createBooking({
        customerId: Number(user.id),
        flightId: flight.id,
        totalPrice: flight.price }).unwrap();
      toast.success("Flight booked successfully");
      setShowBookDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.error(message || "Failed to book flight");
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

  const getBookingButtonText = () => {
    if (isBookingDataLoading) {
      return "Loading...";
    }

    if (!isFlightBooked) {
      return flight.seatsAvailable <= 0 ? "Fully Booked" : "Book Now";
    }

    switch (bookingStatus) {
      case "PENDING":
        return "Booked";
      case "CONFIRMED":
        return "Confirmed";
      case "CANCELLED":
        return "Cancelled";
      case "COMPLETED":
        return "Completed";
      default:
        return "Booked";
    }
  };

  const isBookingButtonDisabled = () => {
    return (
      isBookingDataLoading ||
      isBooking ||
      isCancelling ||
      (flight.seatsAvailable <= 0 && !isFlightBooked) ||
      bookingStatus === "CANCELLED" ||
      bookingStatus === "COMPLETED" ||
      flight.status === "CANCELLED" ||
      flight.status === "LANDED"
    );
  };

  const handleBookingButtonClick = () => {
    if (isBookingDataLoading) {
      return;
    }

    if (!isFlightBooked) {
      setShowBookDialog(true);
    } else if (isBookingActive) {
      setShowCancelDialog(true);
    }
  };

  const truncatedFlightNumber =
    flight.flightNumber.length > 50
      ? `${flight.flightNumber.slice(0, 47)}...`
      : flight.flightNumber;

  const isLoading =
    isDeleting ||
    isBooking ||
    isCancelling ||
    isUpdatingStatus ||
    isUpdatingDelayed;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero - clean image, content below */}
        <FlightDetailHero
          flight={flight}
          isAdmin={isAdmin}
          isAgent={isAgent}
          isBookingDataLoading={isBookingDataLoading}
          isFlightBooked={isFlightBooked}
          isBookingActive={isBookingActive}
          bookingStatus={bookingStatus}
          bookingButtonText={getBookingButtonText()}
          bookingButtonDisabled={isBookingButtonDisabled()}
          onBookingButtonClick={handleBookingButtonClick}
          onEdit={handleEdit}
          onDeleteClick={() => setShowDeleteDialog(true)}
        />

        <div className="grid grid-cols-1 items-start gap-4 @2xl/main:grid-cols-2 sm:gap-6">
          {/* Origin */}
          <Card className="py-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground mb-2">Origin</p>
                  <p className="break-words [overflow-wrap:anywhere] text-sm text-muted-foreground leading-relaxed">
                    {getDestinationDisplayName(flight.origin)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Destination */}
          <Card className="py-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-secondary-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground mb-2">
                    Destination
                  </p>
                  <p className="break-words [overflow-wrap:anywhere] text-sm text-muted-foreground leading-relaxed">
                    {getDestinationDisplayName(flight.destination)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Departure & Price */}
          <Card className="py-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="font-semibold text-foreground">
                    Departure & Price
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(flight.departure), "MMM dd, yyyy · HH:mm")}
                  </p>
                  <p className="text-lg font-bold text-primary">
                    <Money amount={flight.price} />
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatFlightDuration(flight.duration)}</span>
                    <span>
                      {flight.stops === 0
                        ? "Direct"
                        : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability & Booking */}
          <FlightAvailabilityCard
            flight={flight}
            isAdmin={isAdmin}
            isAgent={isAgent}
            isAvailable={isAvailable}
            isBookingDataLoading={isBookingDataLoading}
            isFlightBooked={isFlightBooked}
            isBookingActive={isBookingActive}
            bookingStatus={bookingStatus}
            isBooking={isBooking}
            isCancelling={isCancelling}
            onBookingButtonClick={handleBookingButtonClick}
          />
        </div>

        {/* Detailed schedule - full width */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <FlightScheduleCard
            flight={flight}
            canUpdateStatus={canUpdateStatus}
            isLoading={isLoading}
            onStatusChange={handleStatusChange}
          />
        </div>

        {/* Published guest reviews (public endpoint: first 5 + total) */}
        <ReviewsSection kind="flights" id={flight.id} />

        {/* Delayed Status Update Modal */}
        <FlightDelayDialog
          open={showDelayedModal}
          onOpenChange={setShowDelayedModal}
          originalDeparture={flight.departure}
          newDeparture={newDeparture}
          newArrival={newArrival}
          onNewDepartureChange={setNewDeparture}
          onNewArrivalChange={setNewArrival}
          onCancel={() => {
            setShowDelayedModal(false);
            setNewDeparture(undefined);
            setNewArrival(undefined);
          }}
          onSubmit={handleDelayedStatusUpdate}
          isUpdating={isUpdatingDelayed}
        />

        {/* Confirmation Dialogs */}
        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Flight"
          description={`Are you sure you want to delete flight "${truncatedFlightNumber}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />

        <ConfirmationDialog
          open={showBookDialog}
          onOpenChange={setShowBookDialog}
          title="Confirm Booking"
          description={`Are you sure you want to book flight "${truncatedFlightNumber}" from ${getDestinationDisplayName(
            flight.origin
          )} to ${getDestinationDisplayName(
            flight.destination
          )} for ${formatMoney(flight.price, { exact: true })}?`}
          onConfirm={handleBook}
          confirmText="Book Now"
        />

        <ConfirmationDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          title="Cancel Booking"
          description={`Are you sure you want to cancel your booking for flight "${truncatedFlightNumber}"? This will update your booking status to CANCELLED.`}
          onConfirm={handleCancelBooking}
          confirmText="Cancel Booking"
          isDestructive
        />
      </div>
    </TooltipProvider>
  );
}
