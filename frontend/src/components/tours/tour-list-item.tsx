// src/components/tours/tour-list-item.tsx
"use client";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ITour } from "@/types/tour.types";
import { Money } from "@/components/ui/Money";

interface ITourListItemProps {
  tour: ITour;
}

/**
 * Minimal clickable card — itinerary details, booking, and admin actions
 * live on the detail view this card links to.
 */
export function TourListItem({ tour }: ITourListItemProps) {
  const spotsLeft = Math.max(0, tour.maxGuests - tour.guestsBooked);

  return (
    <Link
      href={`/dashboard/tours/${tour.id}/detail`}
      className="group flex h-full flex-col gap-3 rounded-xl border border-foreground/15 bg-card p-4 transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <Badge variant="secondary">{tour.type}</Badge>
          <Badge variant="outline">{tour.status}</Badge>
        </div>
        <div className="flex-none text-right">
          <p className="text-lg font-semibold text-foreground">
            <Money amount={tour.price} symbol="$" />
          </p>
          <p className="text-[11px] text-muted-foreground">per guest</p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 truncate font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {tour.destination?.name ?? "—"}
        </p>
        <h3 className="truncate font-sans text-lg font-semibold leading-snug text-foreground">
          {tour.name}
        </h3>
        {tour.description && (
          <p className="mt-2 line-clamp-2 min-h-[2.6rem] text-sm leading-relaxed text-muted-foreground">
            {tour.description}
          </p>
        )}
      </div>

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
    </Link>
  );
}
