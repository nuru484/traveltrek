// src/components/hotels/hotel-list-item.tsx
"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { useDeleteHotelMutation } from "@/redux/hotelApi";
import {
  useGetAllUserBookingsQuery,
  useUpdateBookingMutation,
} from "@/redux/bookingApi";
import { IHotel, IHotelRoom } from "@/types/hotel.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Home,
  Eye,
  Edit,
  Trash2,
  Star,
  MapPin,
  Bed,
  Search,
  Calendar,
  X,
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { BookingButton } from "../bookings/BookingButton";
import toast from "react-hot-toast";
import { truncateText } from "@/utils/truncateText";
import Image from "next/image";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

interface IHotelListItemProps {
  hotel: IHotel;
}

export function HotelListItem({ hotel }: IHotelListItemProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = user?.role === "ADMIN" || user?.role === "AGENT";
  const [deleteHotel, { isLoading: isDeleting }] = useDeleteHotelMutation();
  const [updateBooking, { isLoading: isCancelling }] =
    useUpdateBookingMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(
    null
  );
  const [selectedRoomName, setSelectedRoomName] = useState("");
  const [showRooms, setShowRooms] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<IHotelRoom | null>(null);

  const {
    data: bookingsData,
    isError: isBookingsError,
    error: BookingsError,
  } = useGetAllUserBookingsQuery(
    { userId: user?.id, params: { page: 1, limit: 1000 } },
    { skip: !user }
  );

  console.log("Authenticated User: ", user);

  // Filter and search rooms
  const filteredRooms = useMemo(() => {
    if (!hotel.rooms?.length) return [];
    return hotel.rooms.filter(
      (room) =>
        room.roomType.toLowerCase().includes(roomSearch.toLowerCase()) ||
        room.description?.toLowerCase().includes(roomSearch.toLowerCase())
    );
  }, [hotel.rooms, roomSearch]);

  // Displayed rooms (selected or filtered)
  const displayedRooms = useMemo(() => {
    if (selectedRoomId && selectedRoom) return [selectedRoom];
    return filteredRooms;
  }, [selectedRoomId, selectedRoom, filteredRooms]);

  useEffect(() => {
    if (isBookingsError) {
      const { message } = extractApiErrorMessage(BookingsError);
      console.error("Failed to fetch user Bookings:", BookingsError);
      toast.error(message || "Failed to load user bookings");
    }
  }, [isBookingsError, BookingsError]);

  const handleView = () => router.push(`/dashboard/hotels/${hotel.id}/detail`);
  const handleEdit = () => router.push(`/dashboard/hotels/${hotel.id}/edit`);

  const handleDelete = async () => {
    try {
      await deleteHotel(hotel.id).unwrap();
      toast.success("Hotel deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to delete hotel:", error);
      toast.error(message || "Failed to delete hotel");
    }
  };

  const handleRoomView = (roomId: number) =>
    router.push(`/dashboard/rooms/${roomId}/detail`);

  const getDestinationName = () =>
    hotel.destination
      ? `${hotel.destination.name}, ${hotel.destination.country}`
      : "Unknown destination";

  // Get booking for a specific room
  const getRoomBooking = (roomId: number) =>
    bookingsData?.data.find(
      (b) => b?.room?.id === roomId && b.userId === parseInt(user?.id || "0")
    );

  // Check if room is booked
  const isRoomBooked = (roomId: number) => !!getRoomBooking(roomId);

  // Get booking status for a room
  const getRoomBookingStatus = (roomId: number) => {
    const booking = getRoomBooking(roomId);
    return booking?.status;
  };

  // Check if booking is active (can be cancelled)
  const isBookingActive = (roomId: number) => {
    const status = getRoomBookingStatus(roomId);
    return status && status !== "CANCELLED" && status !== "COMPLETED";
  };

  // Handle cancel booking
  const handleCancelBooking = async () => {
    if (!selectedBookingId) return;

    const toastId = toast.loading("Cancelling booking...");

    try {
      await updateBooking({
        bookingId: selectedBookingId,
        data: { status: "CANCELLED" },
      }).unwrap();

      toast.dismiss(toastId);
      toast.success("Booking cancelled successfully");
      setShowCancelDialog(false);
      setSelectedBookingId(null);
      setSelectedRoomName("");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to cancel booking");
      setShowCancelDialog(false);
    }
  };

  // Open cancel dialog
  const handleOpenCancelDialog = (roomId: number, roomType: string) => {
    const booking = getRoomBooking(roomId);
    if (booking) {
      setSelectedBookingId(booking.id);
      setSelectedRoomName(roomType);
      setShowCancelDialog(true);
    }
  };

  // Get button text based on booking status
  const getBookingButtonText = (roomId: number) => {
    const status = getRoomBookingStatus(roomId);
    if (!status) return "Book";

    switch (status) {
      case "PENDING":
        return "Pending";
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

  // Get badge variant based on booking status
  const getBookingBadgeVariant = (roomId: number) => {
    const status = getRoomBookingStatus(roomId);
    switch (status) {
      case "CONFIRMED":
        return "default";
      case "CANCELLED":
        return "destructive";
      case "COMPLETED":
        return "outline";
      case "PENDING":
      default:
        return "secondary";
    }
  };

  return (
    <>
      <Card className="w-full hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row h-full">
            {/* Hotel Image */}
            <div className="relative w-full md:w-1/4 h-40 md:h-auto flex-shrink-0">
              {hotel.photo ? (
                <Image
                  src={hotel.photo}
                  alt={hotel.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 25vw"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <Home className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10" />
            </div>

            {/* Hotel Information */}
            <div className="flex-1 p-4 sm:p-6 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                      {hotel.name}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {hotel.starRating}★
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {hotel.address}
                  </p>
                </div>
                {hotel.rooms?.length ? (
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-lg sm:text-xl font-bold text-primary">
                      From ${Math.min(...hotel.rooms.map((r) => r.price || 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">per night</p>
                  </div>
                ) : null}
              </div>

              {/* Location */}
              <div className="flex items-center justify-between mb-3 py-2 px-3 bg-muted/30 rounded-lg">
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-semibold text-sm">
                    {hotel.city}, {hotel.country}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getDestinationName()}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-wrap justify-between text-xs text-muted-foreground mb-4 gap-2">
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  <span>{hotel.starRating} Star Rating</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{hotel.amenities?.length || 0} Amenities</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bed className="h-3 w-3" />
                  <span>{hotel.rooms?.length || 0} Rooms</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleView}
                  className="flex-1 sm:flex-none sm:min-w-[80px] group-hover:border-primary/50 transition-colors cursor-pointer"
                  disabled={isDeleting}
                >
                  <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">View</span>
                  <span className="sm:hidden">Details</span>
                </Button>

                {isAdmin ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                      disabled={isDeleting}
                    >
                      <Edit className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Edit</span>
                      <span className="sm:hidden">Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive hover:text-destructive hover:border-destructive/50 flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Delete</span>
                      <span className="sm:hidden">Del</span>
                    </Button>
                  </>
                ) : null}

                {/* Show rooms button for both admins and normal users */}
                {hotel.rooms?.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowRooms(!showRooms)}
                    className="flex-1 sm:flex-none sm:min-w-[80px] cursor-pointer"
                  >
                    <Bed className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    {showRooms ? "Hide Rooms" : "View Rooms"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Expandable Rooms */}
          {showRooms && hotel.rooms?.length ? (
            <div className="border-t bg-muted/20 p-4">
              <div className="space-y-3">
                {/* Search & Select */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search rooms..."
                      value={roomSearch}
                      onChange={(e) => setRoomSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select
                    value={selectedRoomId}
                    onValueChange={(v) => {
                      setSelectedRoomId(v);
                      const room = hotel.rooms?.find(
                        (r) => r.id.toString() === v
                      );
                      setSelectedRoom(room || null);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[200px] h-9 cursor-pointer">
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRooms.map((room) => (
                        <SelectItem key={room.id} value={room.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Bed className="h-4 w-4" />
                            <span>{room.roomType}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rooms List */}
                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {displayedRooms.length > 0 ? (
                    displayedRooms.map((room) => {
                      const roomBooked = isRoomBooked(room.id);
                      const bookingActive = isBookingActive(room.id);
                      const bookingStatus = getRoomBookingStatus(room.id);

                      return (
                        <div
                          key={room.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-all"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Bed className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <h4 className="font-medium text-sm truncate">
                                {room.roomType}
                              </h4>
                              {room.price && (
                                <Badge variant="outline" className="text-xs">
                                  ${room.price}
                                </Badge>
                              )}
                              {roomBooked && (
                                <Badge
                                  variant={getBookingBadgeVariant(room.id)}
                                  className="text-xs"
                                >
                                  {bookingStatus}
                                </Badge>
                              )}
                            </div>
                            {room.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {room.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 ml-3 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRoomView(room.id)}
                              className="cursor-pointer"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>

                            {/* Booking buttons based on user role and booking status */}
                            {isAdmin ? (
                              // Admin booking - no userId passed, opens dialog for user selection
                              <BookingButton
                                roomId={room.id}
                                price={room.price || 100}
                                variant="outline"
                                size="sm"
                                className="cursor-pointer"
                              />
                            ) : (
                              <>
                                {roomBooked ? (
                                  <>
                                    {bookingActive ? (
                                      // Active booking - show cancel button
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() =>
                                          handleOpenCancelDialog(
                                            room.id,
                                            room.roomType
                                          )
                                        }
                                        disabled={isCancelling}
                                        className="cursor-pointer"
                                      >
                                        <X className="h-3 w-3 mr-1" />
                                        {isCancelling
                                          ? "Cancelling..."
                                          : "Cancel"}
                                      </Button>
                                    ) : (
                                      // Cancelled or Completed booking - show status
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled
                                        className="cursor-not-allowed"
                                      >
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {getBookingButtonText(room.id)}
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  // Not booked - show book button
                                  <BookingButton
                                    roomId={room.id}
                                    price={room.price || 100}
                                    userId={parseInt(user?.id || "0")}
                                    variant="default"
                                    size="sm"
                                    className="cursor-pointer"
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <Bed className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {roomSearch
                          ? "No rooms found matching your search"
                          : "No rooms available"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Hotel"
        description={`Are you sure you want to delete "${truncateText(
          hotel.name
        )}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        isDestructive
      />

      {/* Cancel Booking Confirmation Dialog */}
      <ConfirmationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="Cancel Booking"
        description={`Are you sure you want to cancel your booking for room "${truncateText(
          selectedRoomName
        )}"? This will update your booking status to CANCELLED.`}
        onConfirm={handleCancelBooking}
        confirmText="Cancel Booking"
        isDestructive
      />
    </>
  );
}
