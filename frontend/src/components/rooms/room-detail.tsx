// src/components/rooms/room-detail.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { useDeleteRoomMutation } from "@/redux/roomApi";
import { useGetAllCustomerBookingsQuery } from "@/redux/bookingApi";
import { IRoom } from "@/types/room.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Edit,
  Trash2,
  MoreHorizontal,
  Building,
  Loader2,
} from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { isAdmin as isAdminUser, isStaff } from "@/utils/roles";
import toast from "react-hot-toast";
import Image from "next/image";
import { Money } from "@/components/ui/Money";
import { BookingButton } from "../bookings/BookingButton";

interface IRoomDetailProps {
  room: IRoom;
}

export function RoomDetail({ room }: IRoomDetailProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = isAdminUser(user);
  // Staff (admin or agent) book on behalf of a customer; only customers self-book.
  const canManageRooms = isStaff(user);

  const [deleteRoom, { isLoading: isDeleting }] = useDeleteRoomMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isAvailable = room.roomsAvailable > 0;

  const {
    data: bookingsData,
    isLoading: isLoadingBookings,
    isFetching: isFetchingBookings,
  } = useGetAllCustomerBookingsQuery(
    { customerId: Number(user?.id), params: { page: 1, limit: 1000 } },
    {
      skip: !user || canManageRooms,
      refetchOnMountOrArgChange: 30,
    }
  );

  // Find active booking for this room
  const userBooking = bookingsData?.data.find(
    (booking) =>
      booking?.room?.id === room.id &&
      booking.customerId === Number(user?.id) &&
      booking.status !== "CANCELLED" &&
      booking.status !== "COMPLETED"
  );

  const hasActiveBooking = !!userBooking;
  const isBookingDataLoading = isLoadingBookings || isFetchingBookings;

  const handleEdit = () => {
    router.push(`/dashboard/rooms/${room.id}/edit`);
  };

  const handleDelete = async () => {
    const toastId = toast.loading("Deleting room...");

    try {
      await deleteRoom(room.id).unwrap();
      toast.dismiss(toastId);
      toast.success("Room deleted successfully");
      setShowDeleteDialog(false);
      router.push("/dashboard/hotels");
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.dismiss(toastId);
      toast.error(message || "Failed to delete room");
    }
  };

  const handleHotelClick = () => {
    if (room.hotel) {
      router.push(`/dashboard/hotels/${room.hotel.id}/detail`);
    }
  };

  const truncatedRoomType =
    room.roomType.length > 50
      ? `${room.roomType.slice(0, 47)}...`
      : room.roomType;

  const availabilityPercentage =
    room.totalRooms > 0 ? (room.roomsAvailable / room.totalRooms) * 100 : 0;

  const getAvailabilityStatus = () => {
    if (room.roomsAvailable === 0) return "Fully booked";
    if (availabilityPercentage > 50) return "Great availability";
    if (availabilityPercentage > 20) return "Limited rooms";
    return "Few rooms left";
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero */}
        <Card className="overflow-hidden py-0 gap-0">
          {room.photo && (
            <div className="relative w-full h-[240px] md:h-[340px]">
              <Image
                src={room.photo}
                alt={room.roomType}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
          <div className="flex items-start justify-between gap-3 p-4 sm:p-6">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={isAvailable ? "outline" : "destructive"}>
                  {isAvailable
                    ? `${room.roomsAvailable} Available`
                    : "Fully Booked"}
                </Badge>
                <Badge variant="outline">
                  {room.capacity} Guest{room.capacity > 1 ? "s" : ""}
                </Badge>
                {!canManageRooms && isBookingDataLoading && (
                  <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
                )}
                {!canManageRooms &&
                  hasActiveBooking &&
                  !isBookingDataLoading && (
                    <Badge variant="outline">
                      Booked: {userBooking?.status}
                    </Badge>
                  )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight break-words [overflow-wrap:anywhere]">
                {room.roomType}
              </h1>
              {room.hotel && (
                <button
                  onClick={handleHotelClick}
                  className="flex items-start gap-2 text-left text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline cursor-pointer"
                >
                  <Building className="h-4 w-4 mt-1 flex-none" />
                  <span className="min-w-0 text-sm md:text-base break-words [overflow-wrap:anywhere]">
                    {room.hotel.name}
                  </span>
                </button>
              )}
            </div>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 flex-none cursor-pointer"
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
                    Edit Room
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </Card>

        {/* Details & booking */}
        <Card className="py-0 max-sm:rounded-none max-sm:border-x-0 max-sm:bg-transparent">
          <CardContent className="space-y-6 p-4 sm:p-6 max-sm:px-3">
            <div className="grid grid-cols-1 gap-8 @2xl/main:grid-cols-2">
              {/* Room details */}
              <div className="min-w-0 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Room details
                </h2>
                <dl className="space-y-4">
                  {room.description && (
                    <div className="min-w-0">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Description
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere]">
                        {room.description}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Capacity
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">
                      Up to {room.capacity} guest{room.capacity > 1 ? "s" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Total rooms
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">
                      {room.totalRooms} room{room.totalRooms > 1 ? "s" : ""} in
                      this category
                    </dd>
                  </div>
                  {room.amenities && room.amenities.length > 0 && (
                    <div className="min-w-0">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Amenities
                      </dt>
                      <dd className="mt-1.5 flex flex-wrap gap-1.5">
                        {room.amenities.map((amenity, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="max-w-full text-xs"
                          >
                            <span className="truncate">{amenity}</span>
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Pricing & booking */}
              <div className="min-w-0 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Pricing & booking
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Price per night
                    </p>
                    <p className="mt-1 break-words font-display text-3xl font-semibold tracking-tight text-foreground">
                      <Money amount={room.pricePerNight} />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Excluding taxes and fees
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Availability
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-foreground transition-all duration-500"
                        style={{ width: `${availabilityPercentage}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {room.roomsBooked} of {room.totalRooms} rooms booked ·{" "}
                      {getAvailabilityStatus()}
                    </p>
                  </div>

                  {/* Booking actions */}
                  <div className="space-y-3 pt-2">
                    {canManageRooms ? (
                      <BookingButton
                        roomId={room.id}
                        price={room.pricePerNight}
                        variant="default"
                        size="lg"
                        className="w-full cursor-pointer"
                        disabled={isDeleting}
                        label={
                          !isAvailable
                            ? "Fully Booked - Book Anyway"
                            : "Book for Customer"
                        }
                      />
                    ) : (
                      <>
                        {isBookingDataLoading ? (
                          <Button
                            variant="secondary"
                            className="w-full"
                            size="lg"
                            disabled
                          >
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading booking status...
                          </Button>
                        ) : hasActiveBooking ? (
                          <div className="space-y-2">
                            <div className="rounded-lg border border-border bg-muted/50 p-4">
                              <p className="mb-1 text-sm font-medium text-foreground">
                                You have an active booking
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Status:{" "}
                                <span className="font-medium">
                                  {userBooking?.status}
                                </span>
                              </p>
                              {userBooking?.type === "ROOM" &&
                                userBooking.room?.startDate &&
                                userBooking.room?.endDate && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {new Date(
                                      userBooking.room.startDate
                                    ).toLocaleDateString()}{" "}
                                    –{" "}
                                    {new Date(
                                      userBooking.room.endDate
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                            </div>
                            <Button
                              variant="outline"
                              className="w-full cursor-pointer hover:text-foreground"
                              size="lg"
                              onClick={() =>
                                router.push(
                                  `/dashboard/bookings/${userBooking.id}`
                                )
                              }
                            >
                              View Booking Details
                            </Button>
                          </div>
                        ) : (
                          <BookingButton
                            roomId={room.id}
                            price={room.pricePerNight}
                            customerId={user?.id ? Number(user.id) : undefined}
                            variant="default"
                            size="lg"
                            className="w-full cursor-pointer"
                            disabled={!isAvailable && !canManageRooms}
                            label={
                              !isAvailable ? "Fully Booked" : "Book This Room"
                            }
                          />
                        )}
                      </>
                    )}

                    {!isAvailable && (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        This room is currently fully booked. Check back later or
                        try different dates.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <dl className="grid grid-cols-1 gap-3 border-t border-dashed border-foreground/20 pt-4 min-[480px]:grid-cols-2">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Created
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {new Date(room.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Last updated
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {new Date(room.updatedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Delete Room Confirmation Dialog */}
        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Room"
          description={`Are you sure you want to delete room "${truncatedRoomType}"? This action cannot be undone and will affect all associated bookings.`}
          onConfirm={handleDelete}
          confirmText="Delete Room"
          isDestructive
        />
      </div>
    </TooltipProvider>
  );
}
