"use client";
import { useState, useEffect } from "react";
import { useCreateBookingMutation } from "@/redux/bookingApi";
import {
  useGetAllCustomersQuery,
  useLazyGetAllCustomersQuery,
} from "@/redux/customerApi";
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
import { User, Bookmark, Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import {
  buildBookingPayload,
  calculateTotalPrice,
  clampGuests,
  clampRooms,
} from "./booking-button-logic";
import {
  GuestsField,
  RoomBookingFields,
  SpecialRequestsField,
} from "./booking-details-fields";
import { BookingPriceSummary } from "./booking-price-summary";

interface IBookingButtonProps {
  tourId?: number;
  flightId?: number;
  roomId?: number;
  price: number;
  /** Self-booking: the logged-in customer's id. Staff omit it and pick a customer. */
  customerId?: number;
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
  customerId,
  disabled = false,
  variant = "default",
  size = "default",
  className = "",
  label,
}: IBookingButtonProps) {
  const [createBooking, { isLoading }] = useCreateBookingMutation();
  // Staff pick a customer to book for; skip the staff-only list for self-booking.
  const { data: customersData, isLoading: isCustomersLoading } =
    useGetAllCustomersQuery({ page: 1, limit: 50 }, { skip: Boolean(customerId) });

  const [
    searchCustomers,
    { data: searchData, isError: isSearchError, error: searchError },
  ] = useLazyGetAllCustomersQuery();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");

  // State for the additional booking details. The counts are kept as raw
  // strings so the field can be cleared while typing; they are clamped on
  // blur and when the booking is submitted.
  const [numberOfGuests, setNumberOfGuests] = useState<string>("1");
  const [specialRequests, setSpecialRequests] = useState<string>("");

  // Room-specific state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [numberOfRooms, setNumberOfRooms] = useState<string>("1");

  const guestsCount = clampGuests(numberOfGuests);
  const roomsCount = clampRooms(numberOfRooms);

  // Calculate total price based on number of guests
  const calculatedTotalPrice = calculateTotalPrice(price, guestsCount);

  // Handle search errors
  useEffect(() => {
    if (isSearchError && searchError) {
      const { message } = extractApiErrorMessage(searchError);
      toast.error(message || "Failed to search customers");
    }
  }, [isSearchError, searchError]);

  // Reset the form whenever the dialog closes (handler instead of an
  // effect watching isDialogOpen, which re-renders twice per close).
  const handleDialogOpenChange = (nextOpen: boolean) => {
    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      setSelectedCustomerId(null);
      setSearchTerm("");
      setNumberOfGuests("1");
      setSpecialRequests("");
      setStartDate("");
      setEndDate("");
      setNumberOfRooms("1");
    }
  };

  const handleBook = async (finalCustomerId: number) => {
    try {
      // Validate room booking dates
      if (roomId && (!startDate || !endDate)) {
        toast.error(
          "Please select check-in and check-out dates for room booking"
        );
        return;
      }

      const payload = buildBookingPayload({
        customerId: finalCustomerId,
        totalPrice: calculatedTotalPrice,
        numberOfGuests: guestsCount,
        specialRequests,
        tourId,
        flightId,
        roomId,
        startDate,
        endDate,
        numberOfRooms: roomsCount,
      });

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
      toast.error(message || "Failed to create booking");
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (val.trim().length > 1) {
      const delayDebounce = setTimeout(() => {
        searchCustomers({ search: val, page: 1, limit: 50 });
      }, 400);
      return () => clearTimeout(delayDebounce);
    }
  };

  const availableCustomers =
    searchTerm.trim().length > 1
      ? searchData?.data || []
      : customersData?.data || [];

  // Get minimum date (today)
  const minDate = new Date().toISOString().split("T")[0];

  return (
    <>
      {customerId ? (
        // Customer self-booking: show dialog for additional details
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
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
              <GuestsField
                id="guests"
                value={numberOfGuests}
                onChange={setNumberOfGuests}
                onBlur={() => setNumberOfGuests(String(guestsCount))}
                price={price}
                placeholder="Enter number of guests"
              />

              {roomId && (
                <RoomBookingFields
                  minDate={minDate}
                  startDate={startDate}
                  endDate={endDate}
                  numberOfRooms={numberOfRooms}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onRoomsChange={setNumberOfRooms}
                  onRoomsBlur={() => setNumberOfRooms(String(roomsCount))}
                  roomsPlaceholder="Enter number of rooms"
                />
              )}

              <SpecialRequestsField
                id="special-requests"
                value={specialRequests}
                onChange={setSpecialRequests}
                placeholder="Any special requirements or preferences..."
                showCount
              />

              <BookingPriceSummary
                price={price}
                guestsCount={guestsCount}
                totalPrice={calculatedTotalPrice}
                className="rounded-lg bg-muted/50 p-3 sm:p-4 border border-border"
              />
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
                onClick={() => handleBook(customerId)}
                disabled={isLoading || Boolean(roomId && (!startDate || !endDate))}
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
        // Admin/agent: select a customer via dialog with additional fields
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
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
                Select a customer and provide booking details.
              </DialogDescription>
            </DialogHeader>

            <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 overflow-hidden">
              {/* Search Input */}
              <div className="space-y-2">
                <Label
                  htmlFor="customer-search"
                  className="text-sm font-medium break-words"
                >
                  Search Customers
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    id="customer-search"
                    placeholder="Search by name, email or phone..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Customer Selection */}
                <div className="space-y-2">
                  <Label
                    htmlFor="customer-select"
                    className="text-sm font-medium break-words"
                  >
                    Select Customer
                  </Label>
                  <Select
                    value={selectedCustomerId ? String(selectedCustomerId) : ""}
                    onValueChange={(val) => setSelectedCustomerId(Number(val))}
                  >
                    <SelectTrigger id="customer-select" className="w-full">
                      <SelectValue placeholder="Choose a customer to book for" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] max-w-[calc(100vw-4rem)] sm:max-w-[468px]">
                      {isCustomersLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : availableCustomers.length > 0 ? (
                        availableCustomers.map((c) => (
                          <SelectItem
                            key={c.id}
                            value={String(c.id)}
                            className="py-3"
                          >
                            <div className="flex flex-col gap-0.5 min-w-0 w-full">
                              <span className="font-medium text-sm break-all line-clamp-2">
                                {c.name}
                              </span>
                              <span className="text-xs text-muted-foreground break-all line-clamp-1">
                                {c.email || c.phone || "No contact"}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="flex flex-col items-center py-8">
                          <User className="h-8 w-8 text-muted-foreground/50 mb-2" />
                          <p className="text-sm">No customers found</p>
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Number of Guests */}
                <GuestsField
                  id="guests-admin"
                  value={numberOfGuests}
                  onChange={setNumberOfGuests}
                  onBlur={() => setNumberOfGuests(String(guestsCount))}
                  price={price}
                />
              </div>

              {roomId && (
                <RoomBookingFields
                  idSuffix="-admin"
                  minDate={minDate}
                  startDate={startDate}
                  endDate={endDate}
                  numberOfRooms={numberOfRooms}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onRoomsChange={setNumberOfRooms}
                  onRoomsBlur={() => setNumberOfRooms(String(roomsCount))}
                />
              )}

              <SpecialRequestsField
                id="special-requests-admin"
                value={specialRequests}
                onChange={setSpecialRequests}
                placeholder="Any special requirements..."
              />

              <BookingPriceSummary
                price={price}
                guestsCount={guestsCount}
                totalPrice={calculatedTotalPrice}
                className="rounded-lg bg-muted/50 p-3 sm:p-4 border"
              />
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
                onClick={() =>
                  selectedCustomerId && handleBook(selectedCustomerId)
                }
                disabled={
                  !selectedCustomerId ||
                  isLoading ||
                  Boolean(roomId && (!startDate || !endDate))
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
