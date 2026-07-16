// src/components/flights/flight-delay-dialog.tsx
//
// The DELAYED-status modal: pick a new departure/arrival pair for the flight.
// Validation and submission stay with the parent; this renders the inputs.
"use client";
import { format, isBefore } from "date-fns";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from "@/components/ui/dialog";
import {
  formatFlightDateTime,
  formatFlightDuration } from "./flight-detail-logic";

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

interface IFlightDelayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The flight's currently scheduled departure. */
  originalDeparture: string | Date;
  newDeparture: Date | undefined;
  newArrival: Date | undefined;
  onNewDepartureChange: (date: Date | undefined) => void;
  onNewArrivalChange: (date: Date | undefined) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isUpdating: boolean;
}

export function FlightDelayDialog({
  open,
  onOpenChange,
  originalDeparture,
  newDeparture,
  newArrival,
  onNewDepartureChange,
  onNewArrivalChange,
  onCancel,
  onSubmit,
  isUpdating }: IFlightDelayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Flight Delay</DialogTitle>
          <DialogDescription>
            Please enter the new departure and arrival times for the delayed
            flight. The new departure must be after the original scheduled
            time of {formatFlightDateTime(originalDeparture)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <DateTimePicker
            date={newDeparture}
            onChange={onNewDepartureChange}
            label="New Departure Time"
            minDate={new Date()}
          />
          <DateTimePicker
            date={newArrival}
            onChange={onNewArrivalChange}
            label="New Arrival Time"
            minDate={newDeparture || new Date()}
          />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Original Departure:</strong>{" "}
              {formatFlightDateTime(originalDeparture)}
            </p>
            {newDeparture && newArrival && (
              <p>
                <strong>Preview Duration:</strong>{" "}
                {formatFlightDuration(
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
          <Button variant="outline" onClick={onCancel} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!newDeparture || !newArrival || isUpdating}
          >
            {isUpdating ? (
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
  );
}
