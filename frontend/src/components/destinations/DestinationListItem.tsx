// src/components/destinations/DestinationListItem.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { IDestination } from "@/types/destination.types";

interface IDestinationListItemProps {
  destination: IDestination;
}

/**
 * Minimal clickable card — tours, hotels, flights, and admin actions live on
 * the detail view this card links to.
 */
export function DestinationListItem({
  destination,
}: IDestinationListItemProps) {
  return (
    <Link
      href={`/dashboard/destinations/${destination.id}/detail`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-foreground/15 bg-card transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* Banner */}
      <div className="relative h-36 w-full flex-none bg-muted">
        {destination.photo ? (
          <Image
            src={destination.photo}
            alt={destination.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MapPin className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {[destination.city, destination.country].filter(Boolean).join(" · ")}
        </p>
        <p className="truncate text-lg font-semibold text-foreground">
          {destination.name}
        </p>
        {destination.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {destination.description}
          </p>
        )}
      </div>
    </Link>
  );
}
