// src/components/hotels/hotel-list-item.tsx
"use client";
import Link from "next/link";
import Image from "next/image";
import { Hotel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IHotel } from "@/types/hotel.types";

interface IHotelListItemProps {
  hotel: IHotel;
}

/**
 * Minimal clickable card — rooms, amenities, and admin actions live on the
 * detail view this card links to.
 */
export function HotelListItem({ hotel }: IHotelListItemProps) {
  const roomCount = hotel.rooms?.length ?? 0;

  return (
    <Link
      href={`/dashboard/hotels/${hotel.id}/detail`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-foreground/15 bg-card transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* Banner */}
      <div className="relative h-36 w-full flex-none bg-muted">
        {hotel.photo ? (
          <Image
            src={hotel.photo}
            alt={hotel.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Hotel className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
        )}
        <Badge className="absolute right-3 top-3 border-transparent bg-card/95 text-foreground">
          {"★".repeat(Math.max(1, Math.min(5, hotel.starRating)))}
        </Badge>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {hotel.destination?.name ?? "—"}
        </p>
        <p className="truncate text-lg font-semibold text-foreground">
          {hotel.name}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {hotel.address}
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashed border-foreground/15 pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>
            {roomCount} room type{roomCount === 1 ? "" : "s"}
          </span>
          <span>
            {hotel.amenities?.length ?? 0} amenit
            {(hotel.amenities?.length ?? 0) === 1 ? "y" : "ies"}
          </span>
        </div>
      </div>
    </Link>
  );
}
