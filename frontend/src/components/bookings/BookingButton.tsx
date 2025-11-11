"use client";
import { useState, useEffect } from "react";
import { useCreateBookingMutation } from "@/redux/bookingApi";
import { useGetAllUsersQuery, useLazySearchUsersQuery } from "@/redux/userApi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { User, Bookmark, Search, Loader2, Calendar, Users } from "lucide-react";
import toast from "react-hot-toast";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { IBookingInput } from "@/types/booking.types";

interface IBookingButtonProps {
  tourId?: number;
  flightId?: number;
  roomId?: number;
  price: number;
  userId?: number;
  disabled?: boolean;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "destructive"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

export function BookingButton({
  tourId,
  flightId,
  roomId,
  price,
  userId,
  disabled = false,
  variant = "default",
  size = "default",
  className = "",
  label,
}: IBookingButtonProps) {
  const [createBooking, { isLoading }] = useCreateBookingMutation();
  const { data: usersData, isLoading: isUsersLoading } = useGetAllUsersQuery({
    page: 1,
    limit: 50,
  });

  const [
    searchUsers,
    { data: searchData, isError: isSearchError, error: searchError },
  ] = useLazySearchUsersQuery();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // New state for additional booking details
  const [numberOfGuests, setNumberOfGuests] = useState<number>(1);
  const [specialRequests, setSpecialRequests] = useState<string>("");

  // Room-specific state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [numberOfRooms, setNumberOfRooms] = useState<number>(1);

  // Calculate total price based on number of guests
  const calculatedTotalPrice = price * numberOfGuests;

  // Handle search errors
  useEffect(() => {
    if (isSearchError && searchError) {
      const { message } = extractApiErrorMessage(searchError);
      console.error("Failed to search users:", searchError);
      toast.error(message || "Failed to search users");
    }
  }, [isSearchError, searchError]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      setSelectedUserId(null);
      setSearchTerm("");
      setNumberOfGuests(1);
      setSpecialRequests("");
      setStartDate("");
      setEndDate("");
      setNumberOfRooms(1);
    }
  }, [isDialogOpen]);

  const handleBook = async (finalUserId: number) => {
    try {
      // Validate room booking dates
      if (roomId && (!startDate || !endDate)) {
        toast.error(
          "Please select check-in and check-out dates for room booking"
        );
        return;
      }

      const payload: IBookingInput = {
        userId: finalUserId,
        totalPrice: calculatedTotalPrice,
        numberOfGuests,
        specialRequests: specialRequests.trim() || null,
      };

      if (tourId) {
        payload.tourId = tourId;
      } else if (flightId) {
        payload.flightId = flightId;
      } else if (roomId) {
        payload.roomId = roomId;
        payload.startDate = startDate;
        payload.endDate = endDate;
        payload.numberOfRooms = numberOfRooms;
      } else {
        throw new Error("No booking type specified");
      }

      const result = await createBooking(payload).unwrap();

      toast.success("Booking created successfully");

      if (result.data.bookingDetails?.requiresImmediatePayment) {
        toast.success("⚠️ Immediate payment required for this booking", {
          duration: 5000,
        });
      } else if (result.data.bookingDetails?.paymentDeadline) {
        const deadline = new Date(result.data.bookingDetails.paymentDeadline);
        toast.success(`Payment due by ${deadline.toLocaleDateString()}`, {
          duration: 5000,
        });
      }

      setIsDialogOpen(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      console.error("Failed to book:", error);
      toast.error(message || "Failed to create booking");
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (val.trim().length > 1) {
      const delayDebounce = setTimeout(() => {
        searchUsers({ search: val, page: 1, limit: 50 });
      }, 400);
      return () => clearTimeout(delayDebounce);
    }
  };

  const availableUsers =
    searchTerm.trim().length > 1
      ? searchData?.data || []
      : usersData?.data || [];

  // Get minimum date (today)
  const minDate = new Date().toISOString().split("T")[0];

  return (
    <>
      {userId ? (
        // Normal user: Show dialog for additional details
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant={variant}
              size={size}
              disabled={disabled || isLoading}
              className={className}
            >
              <Bookmark className="mr-2 h-4 w-4" />
              {label || "Book"}
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">
                Confirm Booking
              </DialogTitle>
              <DialogDescription className="text-sm">
                Please provide additional details for your booking.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Number of Guests */}
              <div className="space-y-2">
                <Label
                  htmlFor="guests"
                  className="flex items-center gap-2 text-sm"
                >
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span className="break-words">Number of Guests</span>
                </Label>
                <Input
                  id="guests"
                  type="number"
                  min={1}
                  max={20}
                  value={numberOfGuests}
                  onChange={(e) =>
                    setNumberOfGuests(
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  }
                  placeholder="Enter number of guests"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground break-words">
                  Price per guest: ${price.toFixed(2)}
                </p>
              </div>

              {/* Room-specific fields */}
              {roomId && (
                <>
                  <div className="space-y-2">
                    <Label
                      htmlFor="check-in"
                      className="flex items-center gap-2 text-sm"
                    >
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="break-words">Check-in Date</span>
                    </Label>
                    <Input
                      id="check-in"
                      type="date"
                      min={minDate}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="check-out"
                      className="flex items-center gap-2 text-sm"
                    >
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="break-words">Check-out Date</span>
                    </Label>
                    <Input
                      id="check-out"
                      type="date"
                      min={startDate || minDate}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="num-rooms" className="text-sm break-words">
                      Number of Rooms
                    </Label>
                    <Input
                      id="num-rooms"
                      type="number"
                      min={1}
                      max={10}
                      value={numberOfRooms}
                      onChange={(e) =>
                        setNumberOfRooms(
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                      placeholder="Enter number of rooms"
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {/* Special Requests */}
              <div className="space-y-2">
                <Label
                  htmlFor="special-requests"
                  className="text-sm break-words"
                >
                  Special Requests (Optional)
                </Label>
                <Textarea
                  id="special-requests"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any special requirements or preferences..."
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {specialRequests.length}/500 characters
                </p>
              </div>

              {/* Price Display - Updated */}
              <div className="rounded-lg bg-muted/50 p-3 sm:p-4 border border-border">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2 text-sm">
                    <span className="text-muted-foreground break-words flex-1">
                      Base Price (per guest)
                    </span>
                    <span className="font-medium whitespace-nowrap">
                      ${price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-2 text-sm">
                    <span className="text-muted-foreground break-words flex-1">
                      Number of Guests
                    </span>
                    <span className="font-medium whitespace-nowrap">
                      × {numberOfGuests}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-medium text-muted-foreground break-words flex-1">
                      Total Price
                    </span>
                    <span className="text-lg font-semibold text-foreground whitespace-nowrap">
                      ${calculatedTotalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleBook(userId)}
                disabled={isLoading || (roomId && (!startDate || !endDate))}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                    <span className="truncate">Processing...</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Confirm Booking</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        // Admin/agent: select user via dialog with additional fields
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant={variant}
              size={size}
              disabled={disabled || isLoading}
              className={className}
            >
              <Bookmark className="mr-2 h-4 w-4" />
              {label || "Book"}
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto gap-0 p-0">
            <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 space-y-2">
              <DialogTitle className="text-lg sm:text-xl font-semibold break-words pr-8">
                Create Booking
              </DialogTitle>
              <DialogDescription className="text-left text-sm text-muted-foreground break-words">
                Select a user and provide booking details.
              </DialogDescription>
            </DialogHeader>

            <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 overflow-hidden">
              {/* Search Input */}
              <div className="space-y-2">
                <Label
                  htmlFor="user-search"
                  className="text-sm font-medium break-words"
                >
                  Search Users
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    id="user-search"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 w-full"
                  />
                </div>
              </div>

              {/* User Selection */}
              <div className="space-y-2">
                <Label
                  htmlFor="user-select"
                  className="text-sm font-medium break-words"
                >
                  Select User
                </Label>
                <Select
                  value={selectedUserId ? String(selectedUserId) : ""}
                  onValueChange={(val) => setSelectedUserId(Number(val))}
                >
                  <SelectTrigger id="user-select" className="w-full">
                    <SelectValue placeholder="Choose a user to book for" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] max-w-[calc(100vw-4rem)] sm:max-w-[468px]">
                    {isUsersLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : availableUsers.length > 0 ? (
                      availableUsers.map((u) => (
                        <SelectItem
                          key={u.id}
                          value={String(u.id)}
                          className="py-3"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 w-full">
                            <span className="font-medium text-sm break-all line-clamp-2">
                              {u.name}
                            </span>
                            <span className="text-xs text-muted-foreground break-all line-clamp-1">
                              {u.email}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="flex flex-col items-center py-8">
                        <User className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p className="text-sm">No users found</p>
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Number of Guests */}
              <div className="space-y-2">
                <Label
                  htmlFor="guests-admin"
                  className="flex items-center gap-2 text-sm"
                >
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span className="break-words">Number of Guests</span>
                </Label>
                <Input
                  id="guests-admin"
                  type="number"
                  min={1}
                  max={20}
                  value={numberOfGuests}
                  onChange={(e) =>
                    setNumberOfGuests(
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  }
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground break-words">
                  Price per guest: ${price.toFixed(2)}
                </p>
              </div>

              {/* Room-specific fields */}
              {roomId && (
                <>
                  <div className="space-y-2">
                    <Label
                      htmlFor="check-in-admin"
                      className="flex items-center gap-2 text-sm"
                    >
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="break-words">Check-in Date</span>
                    </Label>
                    <Input
                      id="check-in-admin"
                      type="date"
                      min={minDate}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="check-out-admin"
                      className="flex items-center gap-2 text-sm"
                    >
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="break-words">Check-out Date</span>
                    </Label>
                    <Input
                      id="check-out-admin"
                      type="date"
                      min={startDate || minDate}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="num-rooms-admin"
                      className="text-sm break-words"
                    >
                      Number of Rooms
                    </Label>
                    <Input
                      id="num-rooms-admin"
                      type="number"
                      min={1}
                      max={10}
                      value={numberOfRooms}
                      onChange={(e) =>
                        setNumberOfRooms(
                          Math.max(1, parseInt(e.target.value) || 1)
                        )
                      }
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {/* Special Requests */}
              <div className="space-y-2">
                <Label
                  htmlFor="special-requests-admin"
                  className="text-sm break-words"
                >
                  Special Requests (Optional)
                </Label>
                <Textarea
                  id="special-requests-admin"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any special requirements..."
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none"
                />
              </div>

              {/* Price Display - Updated */}
              <div className="rounded-lg bg-muted/50 p-3 sm:p-4 border">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2 text-sm">
                    <span className="text-muted-foreground break-words flex-1">
                      Base Price (per guest)
                    </span>
                    <span className="font-medium whitespace-nowrap">
                      ${price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-start gap-2 text-sm">
                    <span className="text-muted-foreground break-words flex-1">
                      Number of Guests
                    </span>
                    <span className="font-medium whitespace-nowrap">
                      × {numberOfGuests}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-medium text-muted-foreground break-words flex-1">
                      Total Price
                    </span>
                    <span className="text-lg font-semibold whitespace-nowrap">
                      ${calculatedTotalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 bg-muted/30 border-t flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
                className="w-full sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedUserId && handleBook(selectedUserId)}
                disabled={
                  !selectedUserId ||
                  isLoading ||
                  (roomId && (!startDate || !endDate))
                }
                className="w-full sm:flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                    <span className="truncate">Processing...</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Confirm Booking</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
