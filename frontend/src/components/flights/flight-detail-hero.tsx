// src/components/flights/flight-detail-hero.tsx
//
// Hero card for the flight detail view: photo banner, status badges, airline
// title and the role-dependent actions (customer booking button / admin menu).
"use client";
import Image from "next/image";
import {
  Bookmark,
  Edit,
  Loader2,
  MoreHorizontal,
  Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { BookingStatus } from "@/types/booking.types";
import type { IFlight } from "@/types/flight.types";
import {
  getFlightStatusConfig } from "./flight-detail-logic";

interface IFlightDetailHeroProps {
  flight: IFlight;
  isAdmin: boolean;
  isAgent: boolean;
  isBookingDataLoading: boolean;
  isFlightBooked: boolean;
  isBookingActive: boolean;
  bookingStatus: BookingStatus | undefined;
  bookingButtonText: string;
  bookingButtonDisabled: boolean;
  onBookingButtonClick: () => void;
  onEdit: () => void;
  onDeleteClick: () => void;
}

export function FlightDetailHero({
  flight,
  isAdmin,
  isAgent,
  isBookingDataLoading,
  isFlightBooked,
  isBookingActive,
  bookingStatus,
  bookingButtonText,
  bookingButtonDisabled,
  onBookingButtonClick,
  onEdit,
  onDeleteClick }: IFlightDetailHeroProps) {
  const flightStatusConfig = getFlightStatusConfig(flight.status);

  return (
    <Card className="overflow-hidden py-0 gap-0">
      {flight.photo && (
        <div className="relative w-full h-[240px] md:h-[340px]">
          <Image
            src={flight.photo}
            alt={`${flight.airline} ${flight.flightNumber}`}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-3 p-4 sm:p-6">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{flight.flightClass}</Badge>
            <Badge variant={flightStatusConfig.variant}>
              {flightStatusConfig.label}
            </Badge>
            {isBookingDataLoading ? (
              <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight break-words [overflow-wrap:anywhere]">
            {flight.airline}
          </h1>
          <p className="break-all font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Flight {flight.flightNumber}
          </p>
        </div>
        <div className="flex flex-none items-center gap-1.5 md:gap-2">
          {!isAdmin && !isAgent && (
            <Button
              variant={isBookingActive ? "secondary" : "default"}
              size="sm"
              onClick={onBookingButtonClick}
              disabled={bookingButtonDisabled}
              className="cursor-pointer whitespace-nowrap"
            >
              {isBookingDataLoading ? (
                <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <Bookmark className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">{bookingButtonText}</span>
            </Button>
          )}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-none cursor-pointer"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Flight
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDeleteClick}
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
    </Card>
  );
}
