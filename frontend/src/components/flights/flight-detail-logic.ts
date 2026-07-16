// src/components/flights/flight-detail-logic.ts
//
// Pure helpers behind the flight detail view: status transitions/metadata,
// display formatting, and the delayed-reschedule validation rules. Kept free
// of React so they can be unit-tested directly.
import { format, isBefore } from "date-fns";
import {
  AlertCircle,
  Clock,
  PlaneLanding,
  PlaneTakeoff,
  XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IDestinationSummary } from "@/types/flight.types";

export const getAvailableStatusTransitions = (currentStatus: string) => {
  const transitions: Record<string, string[]> = {
    SCHEDULED: ["DELAYED", "CANCELLED", "DEPARTED"],
    DELAYED: ["SCHEDULED", "CANCELLED", "DEPARTED"],
    DEPARTED: ["LANDED"],
    CANCELLED: ["SCHEDULED"],
    LANDED: [] };

  return transitions[currentStatus] || [];
};

export interface IFlightStatusConfig {
  variant: "default" | "secondary" | "outline" | "destructive";
  icon: LucideIcon;
  label: string;
}

export const getFlightStatusConfig = (status: string): IFlightStatusConfig => {
  switch (status) {
    case "SCHEDULED":
      return {
        variant: "secondary",
        icon: Clock,
        label: "Scheduled" };
    case "DEPARTED":
      return {
        variant: "default",
        icon: PlaneTakeoff,
        label: "Departed" };
    case "LANDED":
      return {
        variant: "outline",
        icon: PlaneLanding,
        label: "Landed" };
    case "CANCELLED":
      return {
        variant: "destructive",
        icon: XCircle,
        label: "Cancelled" };
    case "DELAYED":
      return {
        variant: "secondary",
        icon: AlertCircle,
        label: "Delayed" };
    default:
      return {
        variant: "secondary",
        icon: Clock,
        label: status };
  }
};

/** "1h 30m" / "45m" from a minute count. */
export const formatFlightDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

/** Long-form timestamp used across the detail view and delay dialog. */
export const formatFlightDateTime = (date: string | Date): string =>
  format(new Date(date), "EEEE, MMMM dd, yyyy HH:mm");

/** "Name (City, Country)" — city omitted when the destination has none. */
export const getDestinationDisplayName = (
  destination: Pick<IDestinationSummary, "name" | "city" | "country">
): string => {
  const cityPart = destination.city ? `${destination.city}, ` : "";
  return `${destination.name} (${cityPart}${destination.country})`;
};

export type IDelayScheduleValidation =
  | { ok: true }
  | { ok: false; error: string };

/**
 * The DELAYED-reschedule rules, in the order the UI reports them: both times
 * present, arrival after departure, departure in the future and after the
 * original schedule, and a total duration between 10 minutes and 24 hours.
 */
export const validateDelaySchedule = (
  newDeparture: Date | undefined,
  newArrival: Date | undefined,
  originalDeparture: Date,
  now: Date = new Date()
): IDelayScheduleValidation => {
  if (!newDeparture || !newArrival) {
    return { ok: false, error: "Please select both departure and arrival times" };
  }

  if (isBefore(newArrival, newDeparture)) {
    return { ok: false, error: "Arrival time must be after departure time" };
  }

  if (isBefore(newDeparture, now)) {
    return { ok: false, error: "Departure time must be in the future" };
  }

  if (isBefore(newDeparture, originalDeparture)) {
    return {
      ok: false,
      error: "Delayed departure must be later than original departure" };
  }

  const duration = Math.round(
    (newArrival.getTime() - newDeparture.getTime()) / (1000 * 60)
  );
  if (duration < 10) {
    return { ok: false, error: "Flight duration cannot be less than 10 minutes" };
  }
  if (duration > 1440) {
    return { ok: false, error: "Flight duration cannot exceed 24 hours" };
  }

  return { ok: true };
};
