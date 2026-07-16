// src/components/flights/flight-detail.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { isBefore } from "date-fns";
import { RootState } from "@/redux/store";
import {
  useDeleteFlightMutation,
  useUpdateFlightStatusMutation } from "@/redux/flightApi";
import {
  useGetAllUserBookingsQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation } from "@/redux/bookingApi";
import { IFlight } from "@/types/flight.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  MapPin,
  Edit,
  Trash2,
  Users,
  Bookmark,
  MoreHorizontal,
  Plane,
  CreditCard,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  PlaneTakeoff,
  PlaneLanding,
  ChevronDown } from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import toast from "react-hot-toast";
import Image from "next/image";
import { Money } from "@/components/ui/Money";

interface IFlightDetailProps {
  flight: IFlight;
}

const getAvailableStatusTransitions = (currentStatus: string) => {
  const transitions: Record<string, string[]> = {
    SCHEDULED: ["DELAYED", "CANCELLED", "DEPARTED"],
    DELAYED: ["SCHEDULED", "CANCELLED", "DEPARTED"],
    DEPARTED: ["LANDED"],
    CANCELLED: ["SCHEDULED"],
    LANDED: [] };

  return transitions[currentStatus] || [];
};

// Simple DateTimePicker component
const DateTimePicker = ({
  date,
  onChange,
  label,
  minDate }: {
  date: Date | undefined;
  onChange: (date: Date | undefined) => void;
  label: string;
  minDate?: Date;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) {
      onChange(undefined);
      return;
    }

    const newDate = new Date(value);
    if (minDate && isBefore(newDate, minDate)) {
      toast.error(`Date must be after ${minDate.toLocaleString()}`);
      return;
    }
    onChange(newDate);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type="datetime-local"
        value={date ? format(date, "yyyy-MM-dd'T'HH:mm") : ""}
        onChange={handleChange}
        className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        min={minDate ? format(minDate, "yyyy-MM-dd'T'HH:mm") : undefined}
      />
    </div>
  );
};

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
    isFetching: isFetchingBookings } = useGetAllUserBookingsQuery(
    { userId: user?.id, params: { page: 1, limit: 1000 } },
    {
      skip: !user,
      refetchOnMountOrArgChange: 30 }
  );

  const userBooking = bookingsData?.data.find(
    (booking) =>
      booking.flight?.id === flight.id &&
      booking.userId === parseInt(user?.id || "0")
  );

  const bookingStatus = userBooking?.status;
  const isFlightBooked = !!userBooking;
  const isBookingActive =
    isFlightBooked &&
    bookingStatus !== "CANCELLED" &&
    bookingStatus !== "COMPLETED";

  const isBookingDataLoading = isLoadingBookings || isFetchingBookings;
  const isAvailable = flight.seatsAvailable > 0;

  const getFlightStatusConfig = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return {
          variant: "secondary" as const,
          icon: Clock,
          label: "Scheduled" };
      case "DEPARTED":
        return {
          variant: "default" as const,
          icon: PlaneTakeoff,
          label: "Departed" };
      case "LANDED":
        return {
          variant: "outline" as const,
          icon: PlaneLanding,
          label: "Landed" };
      case "CANCELLED":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          label: "Cancelled" };
      case "DELAYED":
        return {
          variant: "secondary" as const,
          icon: AlertCircle,
          label: "Delayed" };
      default:
        return {
          variant: "secondary" as const,
          icon: Clock,
          label: status };
    }
  };

  const flightStatusConfig = getFlightStatusConfig(flight.status);
  const StatusIcon = flightStatusConfig.icon;

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
    if (!newDeparture || !newArrival) {
      toast.error("Please select both departure and arrival times");
      return;
    }

    if (isBefore(newArrival, newDeparture)) {
      toast.error("Arrival time must be after departure time");
      return;
    }

    const now = new Date();
    if (isBefore(newDeparture, now)) {
      toast.error("Departure time must be in the future");
      return;
    }

    const originalDeparture = new Date(flight.departure);
    if (isBefore(newDeparture, originalDeparture)) {
      toast.error("Delayed departure must be later than original departure");
      return;
    }

    const duration = Math.round(
      (newArrival.getTime() - newDeparture.getTime()) / (1000 * 60)
    );
    if (duration < 10) {
      toast.error("Flight duration cannot be less than 10 minutes");
      return;
    }
    if (duration > 1440) {
      toast.error("Flight duration cannot exceed 24 hours");
      return;
    }

    setIsUpdatingDelayed(true);
    const toastId = toast.loading("Updating flight with new schedule...");

    try {
      await updateFlightStatus({
        id: flight.id,
        status: selectedDelayedStatus,
        departure: newDeparture.toISOString(),
        arrival: newArrival.toISOString() }).unwrap();

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

  const formatDate = (date: string | Date) => {
    return format(new Date(date), "EEEE, MMMM dd, yyyy HH:mm");
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getDestinationDisplayName = (destination: {
    name: string;
    city: string | null;
    country: string;
  }) => {
    const cityPart = destination.city ? `${destination.city}, ` : "";
    return `${destination.name} (${cityPart}${destination.country})`;
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
        userId: parseInt(user.id),
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

  const availableStatusTransitions = getAvailableStatusTransitions(
    flight.status
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero — clean image, content below */}
        <Card className="overflow-hidden py-0 gap-0">
          {flight.photo && (
            <div className="relative w-full h-[240px] md:h-[340px]">
              <Image
                src={flight.photo}
                alt={`${flight.airline} ${flight.flightNumber}`}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          <div className="flex items-start justify-between gap-3 p-4 sm:p-6">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{flight.flightClass}</Badge>
                <Badge variant={flightStatusConfig.variant}>
                  {flightStatusConfig.label}
                </Badge>
                {isBookingDataLoading ? (
                  <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
                ) : (
                  isFlightBooked && (
                    <Badge
                      variant={
                        bookingStatus === "CONFIRMED"
                          ? "default"
                          : bookingStatus === "CANCELLED"
                          ? "destructive"
                          : bookingStatus === "COMPLETED"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      Booking: {bookingStatus}
                    </Badge>
                  )
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight break-words [overflow-wrap:anywhere]">
                {flight.airline}
              </h1>
              <p className="break-all font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Flight {flight.flightNumber}
              </p>
            </div>
            <div className="flex flex-none items-center gap-1.5 md:gap-2">
              {!isAdmin && !isAgent && (
                <Button
                  variant={isBookingActive ? "secondary" : "default"}
                  size="sm"
                  onClick={handleBookingButtonClick}
                  disabled={isBookingButtonDisabled()}
                  className="cursor-pointer whitespace-nowrap"
                >
                  {isBookingDataLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                  ) : (
                    <Bookmark className="h-4 w-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">
                    {getBookingButtonText()}
                  </span>
                </Button>
              )}
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 flex-none cursor-pointer"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={handleEdit}
                      className="cursor-pointer"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Flight
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Flight
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 items-start gap-4 @2xl/main:grid-cols-2 sm:gap-6">
          {/* Origin */}
          <Card className="py-0 border-l-4 border-l-primary">
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
          <Card className="py-0 border-l-4 border-l-secondary">
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
          <Card className="py-0 border-l-4 border-l-accent">
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
                    <span>{formatDuration(flight.duration)}</span>
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
          <Card className="py-0">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <Users className="h-5 w-5" />
                Availability & Booking
              </h3>
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-foreground">
                        Seats Available
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {flight.seatsAvailable > 0
                          ? `${flight.seatsAvailable} of ${flight.capacity} seats remaining`
                          : "Fully Booked"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        flight.seatsAvailable === 0
                          ? "destructive"
                          : flight.seatsAvailable > 20
                          ? "default"
                          : flight.seatsAvailable > 5
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {flight.seatsAvailable === 0
                        ? "Unavailable"
                        : flight.seatsAvailable > 20
                        ? "Available"
                        : flight.seatsAvailable > 5
                        ? "Limited"
                        : "Few Left"}
                    </Badge>
                  </div>

                  {isBookingDataLoading ? (
                    <div className="h-5 w-40 bg-muted animate-pulse rounded mt-2"></div>
                  ) : (
                    <p
                      className={`text-sm flex items-center gap-2 ${
                        isAvailable &&
                        flight.status !== "CANCELLED" &&
                        flight.status !== "LANDED"
                          ? "text-green-600"
                          : "text-destructive"
                      }`}
                    >
                      {flight.status === "CANCELLED" ? (
                        <>
                          <XCircle className="h-4 w-4" />
                          Flight cancelled
                        </>
                      ) : flight.status === "LANDED" ? (
                        <>
                          <XCircle className="h-4 w-4" />
                          Flight has landed
                        </>
                      ) : isAvailable ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          {isFlightBooked && isBookingActive
                            ? `Booking ${bookingStatus}`
                            : "Ready to book"}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          Fully booked
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Capacity:</span>
                  <p className="font-medium">{flight.capacity} seats</p>
                </div>

                {/* Action Button for Users (non-admin/agent) */}
                {!isAdmin && !isAgent && (
                  <div className="pt-2">
                    {isBookingDataLoading ? (
                      <Button
                        variant="secondary"
                        className="w-full"
                        size="lg"
                        disabled
                      >
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </Button>
                    ) : flight.status === "CANCELLED" ? (
                      <Button disabled className="w-full" size="lg">
                        <XCircle className="h-4 w-4 mr-2" />
                        Flight Cancelled
                      </Button>
                    ) : flight.status === "LANDED" ? (
                      <Button disabled className="w-full" size="lg">
                        <PlaneLanding className="h-4 w-4 mr-2" />
                        Flight Has Landed
                      </Button>
                    ) : !isAvailable && !isFlightBooked ? (
                      <Button disabled className="w-full" size="lg">
                        <XCircle className="h-4 w-4 mr-2" />
                        Fully Booked
                      </Button>
                    ) : bookingStatus === "CANCELLED" ||
                      bookingStatus === "COMPLETED" ? (
                      <Button
                        variant="secondary"
                        className="w-full"
                        size="lg"
                        disabled
                      >
                        <Bookmark className="h-4 w-4 mr-2" />
                        {bookingStatus === "CANCELLED"
                          ? "Cancelled"
                          : "Completed"}
                      </Button>
                    ) : isBookingActive ? (
                      <Button
                        onClick={handleBookingButtonClick}
                        variant="secondary"
                        className="w-full"
                        size="lg"
                        disabled={isCancelling}
                      >
                        <Bookmark className="h-4 w-4 mr-2" />
                        {isCancelling
                          ? "Cancelling..."
                          : `Cancel Booking (${bookingStatus})`}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleBookingButtonClick}
                        className="w-full"
                        size="lg"
                        disabled={isBooking || !isAvailable}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        {isBooking ? "Booking..." : "Book This Flight"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed schedule — full width */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {/* Detailed Schedule */}
          <Card className="py-0">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <Plane className="h-5 w-5" />
                Flight Schedule
              </h3>
              <div className="grid grid-cols-1 items-start gap-4 @2xl/main:grid-cols-4">
                {/* Flight Status with Dropdown for Admin/Agent */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="font-medium text-foreground mb-2">
                    Flight Status
                  </p>
                  {canUpdateStatus && availableStatusTransitions.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer w-full justify-between"
                          disabled={isLoading}
                        >
                          <div className="flex items-center">
                            <StatusIcon className="h-4 w-4 mr-2" />
                            {flightStatusConfig.label}
                          </div>
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <div className="px-2 py-1.5 text-sm font-semibold">
                          Update Status
                        </div>
                        <DropdownMenuSeparator />
                        {availableStatusTransitions.map((status) => {
                          const statusConfig = getFlightStatusConfig(status);
                          const StatusIcon = statusConfig.icon;
                          return (
                            <DropdownMenuItem
                              key={status}
                              onClick={() => handleStatusChange(status)}
                              disabled={isLoading}
                              className="cursor-pointer"
                            >
                              <StatusIcon className="mr-2 h-4 w-4" />
                              {statusConfig.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge
                      variant={flightStatusConfig.variant}
                      className="text-sm"
                    >
                      <StatusIcon className="h-4 w-4 mr-2" />
                      {flightStatusConfig.label}
                    </Badge>
                  )}
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="font-medium text-foreground mb-1">Departure</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(flight.departure)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="font-medium text-foreground mb-1">Arrival</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(flight.arrival)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="font-medium text-foreground mb-1">Duration</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDuration(flight.duration)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>


        </div>

        {/* Delayed Status Update Modal */}
        <Dialog open={showDelayedModal} onOpenChange={setShowDelayedModal}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Flight Delay</DialogTitle>
              <DialogDescription>
                Please enter the new departure and arrival times for the delayed
                flight. The new departure must be after the original scheduled
                time of {formatDate(flight.departure)}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <DateTimePicker
                date={newDeparture}
                onChange={setNewDeparture}
                label="New Departure Time"
                minDate={new Date()}
              />
              <DateTimePicker
                date={newArrival}
                onChange={setNewArrival}
                label="New Arrival Time"
                minDate={newDeparture || new Date()}
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>Original Departure:</strong>{" "}
                  {formatDate(flight.departure)}
                </p>
                {newDeparture && newArrival && (
                  <p>
                    <strong>Preview Duration:</strong>{" "}
                    {formatDuration(
                      Math.round(
                        (newArrival.getTime() - newDeparture.getTime()) /
                          (1000 * 60)
                      )
                    )}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDelayedModal(false);
                  setNewDeparture(undefined);
                  setNewArrival(undefined);
                }}
                disabled={isUpdatingDelayed}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelayedStatusUpdate}
                disabled={!newDeparture || !newArrival || isUpdatingDelayed}
              >
                {isUpdatingDelayed ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Delay"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
          )} for ₵${flight.price.toLocaleString()}?`}
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
