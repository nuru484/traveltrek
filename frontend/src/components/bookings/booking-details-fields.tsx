// src/components/bookings/booking-details-fields.tsx
//
// Shared field blocks for BookingButton's two dialogs (customer self-booking
// and staff booking-for-a-customer), parameterized only where they differ
// (element ids, placeholders, character counter).
"use client";
import { Calendar, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/ui/Money";

export function GuestsField({
  id,
  value,
  onChange,
  onBlur,
  price,
  placeholder }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  /** Integer minor units (pesewas). */
  price: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-sm">
        <Users className="h-4 w-4 flex-shrink-0" />
        <span className="break-words">Number of Guests</span>
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        max={20}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full"
      />
      <p className="text-xs text-muted-foreground break-words">
        Price per guest: <Money amount={price} />
      </p>
    </div>
  );
}

export function RoomBookingFields({
  idSuffix = "",
  minDate,
  startDate,
  endDate,
  numberOfRooms,
  onStartDateChange,
  onEndDateChange,
  onRoomsChange,
  onRoomsBlur,
  roomsPlaceholder }: {
  /** "" for the customer dialog, "-admin" for the staff dialog. */
  idSuffix?: string;
  minDate: string;
  startDate: string;
  endDate: string;
  numberOfRooms: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onRoomsChange: (value: string) => void;
  onRoomsBlur: () => void;
  roomsPlaceholder?: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor={`check-in${idSuffix}`}
            className="flex items-center gap-2 text-sm"
          >
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="break-words">Check-in Date</span>
          </Label>
          <Input
            id={`check-in${idSuffix}`}
            type="date"
            min={minDate}
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor={`check-out${idSuffix}`}
            className="flex items-center gap-2 text-sm"
          >
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="break-words">Check-out Date</span>
          </Label>
          <Input
            id={`check-out${idSuffix}`}
            type="date"
            min={startDate || minDate}
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            required
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`num-rooms${idSuffix}`} className="text-sm break-words">
          Number of Rooms
        </Label>
        <Input
          id={`num-rooms${idSuffix}`}
          type="number"
          min={1}
          max={10}
          value={numberOfRooms}
          onChange={(e) => onRoomsChange(e.target.value)}
          onBlur={onRoomsBlur}
          placeholder={roomsPlaceholder}
          className="w-full"
        />
      </div>
    </>
  );
}

export function SpecialRequestsField({
  id,
  value,
  onChange,
  placeholder,
  showCount = false }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showCount?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm break-words">
        Special Requests (Optional)
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={500}
        className="w-full resize-none"
      />
      {showCount && (
        <p className="text-xs text-muted-foreground">
          {value.length}/500 characters
        </p>
      )}
    </div>
  );
}
