// src/components/flights/flight-list-item.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/ui/rating";
import { IFlight } from "@/types/flight.types";
import { Money } from "@/components/ui/Money";

interface IFlightListItemProps {
  flight: IFlight;
}

/**
 * Minimal clickable card — the details, booking, and admin actions live on
 * the detail view this card links to.
 */
export function FlightListItem({ flight }: IFlightListItemProps) {
  const departure = new Date(flight.departure);
  const hours = Math.floor(flight.duration / 60);
  const minutes = flight.duration % 60;
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <Link
      href={`/dashboard/flights/${flight.id}/detail`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-foreground/15 bg-card transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* Banner */}
      <div className="relative h-36 w-full flex-none bg-muted">
        {flight.photo ? (
          <Image
            src={flight.photo}
            alt={`${flight.airline} ${flight.flightNumber}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Plane className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
        )}
        <Badge className="absolute right-3 top-3 border-transparent bg-card/95 text-foreground">
          {flight.status}
        </Badge>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {flight.airline} · {flight.flightNumber}
            </p>
            <p className="mt-1.5 truncate text-lg font-semibold text-foreground">
              {flight.origin.name} → {flight.destination.name}
            </p>
            <RatingStars rating={flight.rating} className="mt-1.5" />
          </div>
          <div className="flex-none text-right">
            <p className="text-lg font-semibold text-foreground">
              <Money amount={flight.price} />
            </p>
            <p className="text-[11px] text-muted-foreground">per person</p>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashed border-foreground/15 pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>{format(departure, "MMM d · h:mm a")}</span>
          <span>{duration}</span>
          <span>{flight.seatsAvailable} seats</span>
        </div>
      </div>
    </Link>
  );
}
