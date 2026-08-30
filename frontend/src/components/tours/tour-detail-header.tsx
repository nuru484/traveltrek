// src/components/tours/tour-detail-header.tsx
//
// Hero card for the tour detail view: badges, the role-dependent actions
// (customer booking button, admin status + edit/delete menus), title and
// destination link.
"use client";
import Link from "next/link";
import Image from "next/image";
import {
  Bookmark,
  ChevronDown,
  Edit,
  Loader2,
  MapPin,
  MoreHorizontal,
  Tag,
  Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RatingStars } from "@/components/ui/rating";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger } from "@/components/ui/tooltip";
import type { BookingStatus } from "@/types/booking.types";
import type { ITour } from "@/types/tour.types";
import {
  getAvailableStatusTransitions,
  getDestinationDisplay,
  getTourStatusConfig } from "./tour-detail-logic";

interface ITourDetailHeaderProps {
  tour: ITour;
  isAdmin: boolean;
  isAgent: boolean;
  canUpdateStatus: boolean;
  isLoading: boolean;
  isFullyBooked: boolean;
  isBookingDataLoading: boolean;
  isTourBooked: boolean;
  isBookingActive: boolean;
  bookingStatus: BookingStatus | undefined;
  bookingButtonText: string;
  bookingButtonDisabled: boolean;
  onBookingButtonClick: () => void;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onDeleteClick: () => void;
}

export function TourDetailHeader({
  tour,
  isAdmin,
  isAgent,
  canUpdateStatus,
  isLoading,
  isFullyBooked,
  isBookingDataLoading,
  isTourBooked,
  isBookingActive,
  bookingStatus,
  bookingButtonText,
  bookingButtonDisabled,
  onBookingButtonClick,
  onStatusChange,
  onEdit,
  onDeleteClick }: ITourDetailHeaderProps) {
  const tourStatusConfig = getTourStatusConfig(tour.status);
  const availableStatusTransitions = getAvailableStatusTransitions(tour.status);

  return (
    <Card className="overflow-hidden py-0 gap-0">
        {/* Cover photo banner — same hero treatment as flights/hotels. */}
        {tour.photo && (
          <div className="relative w-full h-[240px] md:h-[340px]">
            <Image
              src={tour.photo}
              alt={tour.name}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}
        <div className="p-4 sm:p-5 md:p-6">
          <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-4">
            <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0 overflow-hidden">
              {/* Badges Container with Scroll on Small Screens */}
              <div className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2 mb-1.5 sm:mb-2 max-w-full overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                >
                  <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  {tour.type}
                </Badge>
                {!(canUpdateStatus && availableStatusTransitions.length > 0) && (
                  <Badge
                    variant={tourStatusConfig.variant}
                    className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                  >
                    {tourStatusConfig.label}
                  </Badge>
                )}
                {isFullyBooked && (
                  <Badge
                    variant="destructive"
                    className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                  >
                    Fully Booked
                  </Badge>
                )}
                {isBookingDataLoading ? (
                  <div className="h-4 sm:h-5 w-20 sm:w-24 md:w-32 bg-white/70 animate-pulse rounded-full flex-shrink-0"></div>
                ) : (
                  isTourBooked && (
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
                      className="text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0"
                    >
                      Booking: {bookingStatus}
                    </Badge>
                  )
                )}

              </div>

            </div>

            {/* Actions Dropdown - Always Visible */}
            <div className="flex flex-none flex-row items-center gap-1.5 md:gap-2">
              {!isAdmin && !isAgent && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isBookingActive ? "secondary" : "default"}
                      size="sm"
                      onClick={onBookingButtonClick}
                      disabled={bookingButtonDisabled}
                      className="cursor-pointer h-7 sm:h-8 md:h-9 px-2 sm:px-2.5 md:px-3 text-[10px] sm:text-xs md:text-sm whitespace-nowrap"
                    >
                      {isBookingDataLoading ? (
                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1.5 md:mr-2 animate-spin" />
                      ) : (
                        <Bookmark className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1.5 md:mr-2" />
                      )}
                      <span className="hidden sm:inline">
                        {bookingButtonText}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[200px]">
                    <p className="text-xs">
                      {isBookingDataLoading
                        ? "Loading booking status..."
                        : isBookingActive
                        ? "Cancel booking"
                        : isTourBooked
                        ? `Booking ${bookingStatus}`
                        : "Book this tour"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}

              {canUpdateStatus && availableStatusTransitions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer h-7 sm:h-8 md:h-9 px-1.5 sm:px-2 md:px-3 text-[10px] sm:text-xs md:text-sm"
                      disabled={isLoading}
                    >
                      <span className="text-[11px] sm:text-xs md:text-sm">
                        {tourStatusConfig.label}
                      </span>
                      <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 sm:w-48">
                    <div className="px-2 py-1.5 text-xs sm:text-sm font-semibold">
                      Update Status
                    </div>
                    <DropdownMenuSeparator />
                    {availableStatusTransitions.map((status) => {
                      const statusConfig = getTourStatusConfig(status);
                      const StatusIcon = statusConfig.icon;
                      return (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => onStatusChange(status)}
                          disabled={isLoading}
                          className="cursor-pointer text-xs sm:text-sm"
                        >
                          <StatusIcon className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {statusConfig.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="cursor-pointer h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
                      disabled={isLoading}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 sm:w-44">
                    <DropdownMenuItem
                      onClick={onEdit}
                      disabled={isLoading}
                      className="cursor-pointer text-xs sm:text-sm"
                    >
                      <Edit className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={onDeleteClick}
                      disabled={isLoading}
                      className="text-destructive focus:text-destructive cursor-pointer text-xs sm:text-sm"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <h2 className="mt-3 text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground leading-tight break-words [overflow-wrap:anywhere]">
            {tour.name}
          </h2>
          <RatingStars rating={tour.rating} className="mt-1.5" />
          {tour.destination && (
            <Link
              href={`/dashboard/destinations/${tour.destination.id}/detail`}
              className="mt-1.5 flex items-start gap-1.5 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline sm:gap-2"
            >
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5 sm:mt-1" />
              <span className="min-w-0 text-sm md:text-base break-words [overflow-wrap:anywhere] leading-snug">
                {getDestinationDisplay(tour.destination)}
              </span>
            </Link>
          )}
        </div>
    </Card>
  );
}
