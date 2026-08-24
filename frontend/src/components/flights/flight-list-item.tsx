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
  const route = `${flight.origin.name} → ${flight.destination.name}`;

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
        <div className="min-w-0">
          <p className="line-clamp-1 [overflow-wrap:anywhere] font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {flight.airline} · {flight.flightNumber}
          </p>
          <p
            className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground [overflow-wrap:anywhere] sm:text-base lg:text-lg"
            title={route}
          >
            {route}
          </p>
        </div>

        {/* The fare rides with the rating rather than beside the route: a
            two-line route would squeeze it into the corner. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <RatingStars rating={flight.rating} />
          <p className="text-sm font-semibold tabular-nums text-foreground sm:text-[15px]">
            <Money amount={flight.price} />
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
              / person
            </span>
          </p>
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
