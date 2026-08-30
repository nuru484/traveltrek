// src/components/hotels/hotel-detail.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { RootState } from "@/redux/store";
import { useDeleteHotelMutation } from "@/redux/hotelApi";
import { useGetAllCustomerBookingsQuery } from "@/redux/bookingApi";
import { IHotel } from "@/types/hotel.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/ui/rating";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Home,
  Edit,
  Trash2,
  Bed,
  MoreHorizontal,
  Plus,
  Eye,
  Bookmark,
  DoorOpen,
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { isAdmin as isAdminUser, isStaff } from "@/utils/roles";
import toast from "react-hot-toast";
import Image from "next/image";
import { BookingButton } from "../bookings/booking-button";
import { Money } from "@/components/ui/Money";

interface IHotelDetailProps {
  hotel: IHotel;
}

export function HotelDetail({ hotel }: IHotelDetailProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = isAdminUser(user);
  // Staff (admin or agent) book on behalf of a customer; only customers self-book.
  const staff = isStaff(user);
  const [deleteHotel, { isLoading: isDeleting }] = useDeleteHotelMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    data: bookingsData,
    isError: isBookingsError,
    error: bookingsError } = useGetAllCustomerBookingsQuery(
    { customerId: Number(user?.id), params: { page: 1, limit: 100 } },
    // Customer-only: staff have no booking history of their own.
    { skip: !user || staff }
  );

  useEffect(() => {
    if (isBookingsError) {
      const { message } = extractApiErrorMessage(bookingsError);
      toast.error(message || "Failed to load bookings");
    }
  }, [isBookingsError, bookingsError]);

  const handleEdit = () => {
    router.push(`/dashboard/hotels/${hotel.id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await deleteHotel(hotel.id).unwrap();
      toast.success("Hotel deleted successfully");
      setShowDeleteDialog(false);
      router.push("/dashboard/hotels");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.error(message || "Failed to delete hotel");
    }
  };

  const handleRoomView = (roomId: number) => {
    router.push(`/dashboard/rooms/${roomId}/detail`);
  };

  const handleCreateRoom = () => {
    router.push(`/dashboard/hotels/${hotel.id}/create-room`);
  };

  const isRoomBooked = (roomId: number) => {
    return bookingsData?.data.some(
      (booking) =>
        booking.room?.id === roomId &&
        booking.customerId === Number(user?.id)
    );
  };

  const formatDateLong = (date: string | Date) => {
    return format(new Date(date), "EEEE, MMMM dd, yyyy 'at' h:mm a");
  };

  const truncatedHotelName =
    hotel.name.length > 50 ? `${hotel.name.slice(0, 47)}...` : hotel.name;

  const availableRooms = hotel.rooms?.length || 0;

  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6">
        {/* Hero Section with Hotel Image */}
        <Card className="overflow-hidden py-0 gap-0">
          {hotel.photo && (
            <div className="relative w-full h-[240px] md:h-[340px]">
              <Image
                src={hotel.photo}
                alt={hotel.name}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          <div className="flex items-start justify-between gap-3 p-4 sm:p-6">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">
                  {hotel.starRating} Star{hotel.starRating > 1 ? "s" : ""}
                </Badge>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight break-words [overflow-wrap:anywhere]">
                {hotel.name}
              </h2>
              <RatingStars rating={hotel.rating} />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1 @2xl/main:grid-cols-3">
                {hotel.destination && (
                  <div className="min-w-0">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Location
                    </dt>
                    <dd className="mt-1 break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground">
                      {hotel.destination.city
                        ? `${hotel.destination.city}, `
                        : ""}
                      {hotel.destination.country}
                    </dd>
                  </div>
                )}
                <div className="min-w-0">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Address
                  </dt>
                  <dd className="mt-1 break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground">
                    {hotel.address}
                  </dd>
                </div>
                {hotel.phone && (
                  <div className="min-w-0">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Contact
                    </dt>
                    <dd className="mt-1 break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground">
                      {hotel.phone}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="cursor-pointer h-9 w-9 flex-none"
                    disabled={isDeleting}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={handleEdit}
                    disabled={isDeleting}
                    className="cursor-pointer"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </Card>

        {/* Content Section */}
        <Card className="py-0 max-sm:rounded-none max-sm:border-x-0 max-sm:bg-transparent">
          <CardContent className="p-4 sm:p-6 max-sm:px-3">
            <div className="space-y-6">
              {/* About */}
              <div className="min-w-0">
                <h2 className="mb-3 text-lg font-semibold text-foreground">
                  About
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {hotel.description ||
                    "No description has been added for this hotel yet. Check back later for more details."}
                </p>
              </div>

              {/* Amenities Section */}
              {hotel.amenities && hotel.amenities.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Home className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold text-foreground">
                        Amenities
                      </h2>
                    </div>
                    <ul className="grid grid-cols-1 gap-x-6 gap-y-2 min-[480px]:grid-cols-2">
                      {hotel.amenities.map((amenity, index) => (
                        <li
                          key={index}
                          className="flex min-w-0 items-baseline gap-2 text-sm text-foreground"
                        >
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 flex-none rounded-full bg-accent"
                          />
                          <span className="break-words">{amenity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Metadata Footer */}
              {hotel.createdAt && (
                <div className="pt-4 border-t">
                  <div className="flex flex-col gap-3 text-xs text-muted-foreground min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:gap-4">
                    <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-1.5">
                      <span className="font-medium">Created:</span>
                      <span>{formatDateLong(hotel.createdAt)}</span>
                    </div>
                    {hotel.updatedAt && hotel.createdAt !== hotel.updatedAt && (
                      <>
                        <span className="max-[479px]:hidden">•</span>
                        <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-1.5">
                          <span className="font-medium">Last updated:</span>
                          <span>{formatDateLong(hotel.updatedAt)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available Rooms Section */}
        <Card className="py-0 max-sm:rounded-none max-sm:border-x-0 max-sm:bg-transparent">
          <CardContent className="p-4 sm:p-6 max-sm:px-3">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Bed className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">
                  Available Rooms ({availableRooms})
                </h2>
              </div>
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleCreateRoom}
                      size="sm"
                      className="cursor-pointer"
                      disabled={isDeleting}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Add Room</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create new room for this hotel</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {hotel.rooms && hotel.rooms.length > 0 ? (
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {hotel.rooms.map((room) => {
                  const roomBooked = isRoomBooked(room.id);

                  return (
                    <Card
                      key={room.id}
                      className="transition-all duration-300 group overflow-hidden"
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row h-full">
                          {/* Room Image */}
                          <div className="relative w-full sm:w-2/5 h-40 sm:h-auto flex-shrink-0">
                            {room.photo ? (
                              <Image
                                src={room.photo}
                                alt={room.roomType}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 100vw, 40vw"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <DoorOpen className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                          </div>

                          {/* Room Information */}
                          <div className="min-w-0 flex-1 p-4 flex flex-col">
                            {/* Header */}
                            <div className="mb-3 min-w-0">
                              <h4
                                className="mb-1 line-clamp-2 text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]"
                                title={room.roomType}
                              >
                                {room.roomType}
                              </h4>
                              {room.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 [overflow-wrap:anywhere]">
                                  {room.description}
                                </p>
                              )}
                              {/* The nightly rate keeps a row of its own so a
                                  long room type never squeezes it. */}
                              <p className="mt-2 text-[15px] font-semibold tabular-nums text-primary">
                                <Money amount={room.pricePerNight} />
                                <span className="ml-1 text-xs font-normal text-muted-foreground">
                                  / night
                                </span>
                              </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 mt-auto flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRoomView(room.id)}
                                className="flex-1 sm:flex-none sm:min-w-[80px] group-hover:border-primary/50 transition-colors cursor-pointer"
                              >
                                <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">View</span>
                                <span className="sm:hidden">Details</span>
                              </Button>

                              {staff ? (
                                <BookingButton
                                  roomId={room.id}
                                  price={room.pricePerNight}
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 sm:flex-none sm:min-w-[100px] cursor-pointer"
                                  disabled={isDeleting}
                                  label="Book for Customer"
                                />
                              ) : (
                                <>
                                  {roomBooked ? (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="flex-1 sm:flex-none sm:min-w-[100px]"
                                      disabled
                                    >
                                      <Bookmark className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                      Already Booked
                                    </Button>
                                  ) : (
                                    <BookingButton
                                      roomId={room.id}
                                      price={room.pricePerNight}
                                      customerId={Number(user?.id) || undefined}
                                      variant="default"
                                      size="sm"
                                      className="flex-1 sm:flex-none sm:min-w-[100px] cursor-pointer"
                                      label="Book Now"
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  No rooms currently available
                </p>
                {isAdmin && (
                  <Button
                    onClick={handleCreateRoom}
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    disabled={isDeleting}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Room
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Published guest reviews of this hotel's rooms */}
        <ReviewsSection kind="hotels" id={hotel.id} />

        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Hotel"
          description={`Are you sure you want to delete "${truncatedHotelName}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />
      </div>
    </TooltipProvider>
  );
}
