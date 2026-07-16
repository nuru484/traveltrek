// src/components/tours/tour-info-grid.tsx
//
// Quick-info tiles for the tour detail view: price, duration, dates and
// availability.
"use client";
import {
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  XCircle } from "lucide-react";
import { formatMoney } from "@/utils/format-money";
import type { ITour } from "@/types/tour.types";
import {
  formatTourDate,
  formatTourDuration } from "./tour-detail-logic";

interface ITourInfoGridProps {
  tour: ITour;
  isFullyBooked: boolean;
}

export function TourInfoGrid({ tour, isFullyBooked }: ITourInfoGridProps) {
  return (
    <div className="grid grid-cols-1 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3 gap-4">
      {/* Price */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
        <DollarSign className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Price
          </p>
          <p className="text-2xl font-bold text-primary">
            {formatMoney(tour.price, { exact: true })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">per person</p>
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
        <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Duration
          </p>
          <p className="text-base font-semibold text-foreground">
            {formatTourDuration(tour.duration)}
          </p>
        </div>
      </div>

      {/* Start Date */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
        <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Start Date
          </p>
          <p className="text-base font-semibold text-foreground">
            {formatTourDate(tour.startDate)}
          </p>
        </div>
      </div>

      {/* End Date */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
        <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            End Date
          </p>
          <p className="text-base font-semibold text-foreground">
            {formatTourDate(tour.endDate)}
          </p>
        </div>
      </div>

      {/* Availability */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
        <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Availability
          </p>
          <p className="text-base font-semibold text-foreground">
            {tour.guestsBooked} / {tour.maxGuests} guests
          </p>
          {isFullyBooked ? (
            <p className="text-xs text-destructive mt-1 font-medium flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Fully Booked
            </p>
          ) : tour.status === "CANCELLED" ? (
            <p className="text-xs text-destructive mt-1 font-medium flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Tour cancelled
            </p>
          ) : tour.status === "COMPLETED" ? (
            <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Tour completed
            </p>
          ) : (
            <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {tour.maxGuests - tour.guestsBooked} spots remaining
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
