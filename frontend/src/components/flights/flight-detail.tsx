// src/components/flights/flight-detail.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { RootState } from "@/redux/store";
import { useDeleteFlightMutation } from "@/redux/flightApi";
import {
  useGetAllUserBookingsQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation,
} from "@/redux/bookingApi";
import { IFlight } from "@/types/flight.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Clock,
  MapPin,
  Edit,
  Trash2,
  Users,
  Route,
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
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import toast from "react-hot-toast";
import Image from "next/image";

interface IFlightDetailProps {
  flight: IFlight;
}

export function FlightDetail({ flight }: IFlightDetailProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN";

  const [deleteFlight, { isLoading: isDeleting }] = useDeleteFlightMutation();
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
  } = useGetAllUserBookingsQuery(
    { userId: user?.id, params: { page: 1, limit: 1000 } },
    {
      skip: !user,
      refetchOnMountOrArgChange: 30,
    }
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
          label: "Scheduled",
        };
      case "DEPARTED":
        return {
          variant: "default" as const,
          icon: PlaneTakeoff,
          label: "Departed",
        };
      case "LANDED":
        return {
          variant: "outline" as const,
          icon: PlaneLanding,
          label: "Landed",
        };
      case "CANCELLED":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          label: "Cancelled",
        };
      case "DELAYED":
        return {
          variant: "secondary" as const,
          icon: AlertCircle,
          label: "Delayed",
        };
      default:
        return {
          variant: "secondary" as const,
          icon: Clock,
          label: status,
        };
    }
  };

  const flightStatusConfig = getFlightStatusConfig(flight.status);
  const StatusIcon = flightStatusConfig.icon;

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
      console.error("Failed to delete flight:", error);
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
        totalPrice: flight.price,
      }).unwrap();
      toast.success("Flight booked successfully");
      setShowBookDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to book flight:", error);
      toast.error(message || "Failed to book flight");
    }
  };

  const handleCancelBooking = async () => {
    if (!userBooking) return;

    const toastId = toast.loading("Cancelling booking...");

    try {
      await updateBooking({
        bookingId: userBooking.id,
        data: { status: "CANCELLED" },
      }).unwrap();

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

  const isLoading = isDeleting || isBooking || isCancelling;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section with Flight Image */}
        <Card className="overflow-hidden shadow-sm">
          {flight.photo && (
            <div className="relative w-full h-48 sm:h-56 md:h-64 lg:h-80 xl:h-96">
              <Image
                src={flight.photo}
                alt={`${flight.airline} ${flight.flightNumber}`}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {/* Actions Dropdown */}
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex gap-2">
                {!isAdmin && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isBookingActive ? "secondary" : "default"}
                        size="sm"
                        onClick={handleBookingButtonClick}
                        disabled={isBookingButtonDisabled()}
                        className="bg-white/90 hover:bg-white text-black shadow-sm cursor-pointer"
                      >
                        {isBookingDataLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Bookmark className="h-4 w-4 mr-2" />
                        )}
                        <span className="hidden sm:inline">
                          {getBookingButtonText()}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {isBookingDataLoading
                          ? "Loading booking status..."
                          : isBookingActive
                          ? "Cancel booking"
                          : isFlightBooked
                          ? `Booking ${bookingStatus}`
                          : "Book this flight"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-white/90 hover:bg-white text-black shadow-sm cursor-pointer"
                        disabled={isLoading}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={handleEdit}
                        disabled={isLoading}
                        className="cursor-pointer"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Flight
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={isLoading}
                        className="text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Flight
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Hero Content */}
              <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-white/90 text-black"
                    >
                      {flight.flightClass}
                    </Badge>
                    {/* Flight Status Badge */}
                    <Badge
                      variant={flightStatusConfig.variant}
                      className="bg-white/90 text-black"
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {flightStatusConfig.label}
                    </Badge>
                    {isBookingDataLoading ? (
                      <div className="h-5 w-32 bg-white/70 animate-pulse rounded-full"></div>
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
                          className="bg-white/90 text-black"
                        >
                          Booking: {bookingStatus}
                        </Badge>
                      )
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white line-clamp-2">
                    {flight.airline}
                  </h1>
                  <p className="text-sm sm:text-base lg:text-lg text-white/90">
                    Flight {flight.flightNumber}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Content when no image */}
          {!flight.photo && (
            <div className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-secondary/10">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{flight.flightClass}</Badge>
                    {/* Flight Status Badge */}
                    <Badge variant={flightStatusConfig.variant}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {flightStatusConfig.label}
                    </Badge>
                    {isBookingDataLoading ? (
                      <div className="h-5 w-32 bg-gray-200 animate-pulse rounded-full"></div>
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
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                    {flight.airline}
                  </h1>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Flight {flight.flightNumber}
                  </p>
                </div>

                {/* Actions for no image state */}
                <div className="flex gap-2">
                  {!isAdmin && (
                    <Button
                      variant={isBookingActive ? "secondary" : "default"}
                      size="sm"
                      onClick={handleBookingButtonClick}
                      disabled={isBookingButtonDisabled()}
                      className="cursor-pointer"
                    >
                      {isBookingDataLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Bookmark className="h-4 w-4 mr-2" />
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
                          size="sm"
                          className="cursor-pointer"
                          disabled={isLoading}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={handleEdit}
                          disabled={isLoading}
                          className="cursor-pointer"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Flight
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setShowDeleteDialog(true)}
                          disabled={isLoading}
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
            </div>
          )}
        </Card>

        {/* Flight Details - Horizontal Layout */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Origin */}
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground mb-2">Origin</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {getDestinationDisplayName(flight.origin)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Destination */}
          <Card className="border-l-4 border-l-secondary">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-secondary-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground mb-2">
                    Destination
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {getDestinationDisplayName(flight.destination)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card className="border-l-4 border-l-accent">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-accent-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-3">
                  <p className="font-semibold text-foreground mb-2">Schedule</p>
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      Departure
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(flight.departure), "MMM dd, HH:mm")}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      Arrival
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(flight.arrival), "MMM dd, HH:mm")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Details */}
          <Card className="border-l-4 border-l-muted">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground mb-2">
                    Price & Details
                  </p>
                  <div className="space-y-2">
                    <p className="text-lg font-bold text-primary">
                      ₵{flight.price.toLocaleString()}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(flight.duration)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <Route className="h-3 w-3" />
                          {flight.stops === 0
                            ? "Direct"
                            : `${flight.stops} stop${
                                flight.stops > 1 ? "s" : ""
                              }`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expanded Schedule & Availability Section */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Detailed Schedule */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <Plane className="h-5 w-5" />
                Flight Schedule
              </h3>
              <div className="space-y-4">
                {/* Flight Status */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="font-medium text-foreground mb-2">
                    Flight Status
                  </p>
                  <Badge
                    variant={flightStatusConfig.variant}
                    className="text-sm"
                  >
                    <StatusIcon className="h-4 w-4 mr-2" />
                    {flightStatusConfig.label}
                  </Badge>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="font-medium text-foreground mb-1">Departure</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(flight.departure)}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="font-medium text-foreground mb-1">Arrival</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(flight.arrival)}
                  </p>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    Flight Duration:
                  </span>
                  <span className="font-medium">
                    {formatDuration(flight.duration)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability */}
          <Card>
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

                  {/* Booking Status */}
                  {isBookingDataLoading ? (
                    <div className="h-5 w-40 bg-gray-200 animate-pulse rounded mt-2"></div>
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
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Class:</span>
                    <p className="font-medium">{flight.flightClass}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stops:</span>
                    <p className="font-medium">
                      {flight.stops === 0
                        ? "Direct"
                        : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Capacity:</span>
                    <p className="font-medium">{flight.capacity} seats</p>
                  </div>
                </div>

                {/* Action Button for Users */}
                {!isAdmin && (
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
