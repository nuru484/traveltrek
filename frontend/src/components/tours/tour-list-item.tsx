// src/components/tours/tour-list-item.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/ui/rating";
import { ITour } from "@/types/tour.types";
import { Money } from "@/components/ui/Money";

interface ITourListItemProps {
  tour: ITour;
}

/**
 * Minimal clickable card — itinerary details, booking, and admin actions
 * live on the detail view this card links to. Same cover-photo banner
 * treatment as the hotel/flight cards.
 */
export function TourListItem({ tour }: ITourListItemProps) {
  const spotsLeft = Math.max(0, tour.maxGuests - tour.guestsBooked);

  return (
    <Link
      href={`/dashboard/tours/${tour.id}/detail`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-foreground/15 bg-card transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* Banner */}
      <div className="relative h-36 w-full flex-none bg-muted">
        {tour.photo ? (
          <Image
            src={tour.photo}
            alt={tour.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MapPin className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
        )}
        <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
          <Badge className="border-transparent bg-card/95 text-foreground">
            {tour.type}
          </Badge>
          <Badge className="border-transparent bg-card/95 text-foreground">
            {tour.status}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {tour.destination?.name ?? "—"}
        </p>
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-sans text-lg font-semibold leading-snug text-foreground">
            {tour.name}
          </h3>
          <div className="flex-none text-right">
            <p className="text-lg font-semibold text-foreground">
              <Money amount={tour.price} />
            </p>
            <p className="text-[11px] text-muted-foreground">per guest</p>
          </div>
        </div>
        <RatingStars rating={tour.rating} />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashed border-foreground/15 pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>
            {format(new Date(tour.startDate), "MMM d")} –{" "}
            {format(
              new Date(tour.endDate),
              new Date(tour.startDate).getFullYear() ===
                new Date(tour.endDate).getFullYear()
                ? "MMM d"
                : "MMM d, yyyy"
            )}
          </span>
          <span>
            {tour.duration} day{tour.duration === 1 ? "" : "s"}
          </span>
          <span>{spotsLeft} spots left</span>
        </div>
      </div>
    </Link>
  );
}
