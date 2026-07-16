// Inventory cards for the live demo page: real rows from the public API,
// each linking through the login redirect into the dashboard. Moved from the
// landing page's LiveShowcaseSection when the demo got its own page.
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, Hotel, MapPin, Plane } from "lucide-react";
import { RatingStars } from "@/components/ui/rating";
import { formatMoney } from "@/utils/format-money";
import type { IPublicDestination } from "@/lib/public-api";
import type { IFlight } from "@/types/flight.types";
import type { IHotel } from "@/types/hotel.types";
import type { ITour } from "@/types/tour.types";
import { demoHref, destinationLine } from "./showcase-logic";

export const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
    {children}
  </p>
);

export const TourCard = ({ tour }: { tour: ITour }) => (
  <Link
    href={demoHref(`/dashboard/tours/${tour.id}/detail`)}
    className="group flex h-full flex-col overflow-hidden rounded-xl border border-foreground/15 bg-card transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
  >
    <div className="relative h-40 w-full flex-none bg-muted">
      {tour.photo ? (
        <Image
          src={tour.photo}
          alt={tour.name}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <MapPin className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
      )}
      <span className="absolute right-3 top-3 rounded-full bg-card/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-foreground">
        {tour.type}
      </span>
    </div>
    <div className="flex flex-1 flex-col gap-2 p-4">
      <p className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {tour.destination
          ? destinationLine(tour.destination)
          : "Destination TBA"}
      </p>
      <p className="truncate text-lg font-semibold text-foreground">
        {tour.name}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <RatingStars rating={tour.rating} />
        <p className="text-base font-semibold text-foreground">
          {formatMoney(tour.price)}
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            / guest
          </span>
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-dashed border-foreground/15 pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        <span>
          {format(new Date(tour.startDate), "MMM d")} –{" "}
          {format(new Date(tour.endDate), "MMM d")}
        </span>
        <span className="inline-flex items-center gap-1 text-foreground/80 transition-colors group-hover:text-foreground">
          Sign in to book
          <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </div>
  </Link>
);

export const DestinationChip = ({
  destination,
}: {
  destination: IPublicDestination;
}) => (
  <li className="flex flex-none items-center gap-2.5 rounded-full border border-foreground/15 bg-card py-1.5 pl-1.5 pr-4">
    <span className="relative h-8 w-8 flex-none overflow-hidden rounded-full bg-muted">
      {destination.photo ? (
        <Image
          src={destination.photo}
          alt=""
          fill
          className="object-cover"
          sizes="32px"
        />
      ) : (
        <MapPin
          className="absolute inset-0 m-auto h-3.5 w-3.5 text-muted-foreground"
          aria-hidden
        />
      )}
    </span>
    <span className="min-w-0">
      <span className="block max-w-40 truncate text-sm font-medium leading-tight">
        {destination.name}
      </span>
      <span className="block font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        {destination.country}
      </span>
    </span>
  </li>
);

export const HotelCard = ({ hotel }: { hotel: IHotel }) => (
  <Link
    href={demoHref(`/dashboard/hotels/${hotel.id}/detail`)}
    className="group flex h-full gap-3.5 rounded-xl border border-foreground/15 bg-card p-3.5 transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
  >
    <span className="relative h-20 w-20 flex-none overflow-hidden rounded-lg bg-muted">
      {hotel.photo ? (
        <Image
          src={hotel.photo}
          alt=""
          fill
          className="object-cover"
          sizes="80px"
        />
      ) : (
        <Hotel
          className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground"
          aria-hidden
        />
      )}
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        Hotel · {"★".repeat(Math.max(1, Math.min(5, hotel.starRating)))}
      </span>
      <span className="truncate text-[15px] font-semibold leading-snug">
        {hotel.name}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {hotel.destination ? destinationLine(hotel.destination) : hotel.address}
      </span>
      <span className="mt-auto">
        <RatingStars rating={hotel.rating} />
      </span>
    </span>
  </Link>
);

export const FlightCard = ({ flight }: { flight: IFlight }) => (
  <Link
    href={demoHref(`/dashboard/flights/${flight.id}/detail`)}
    className="group flex h-full gap-3.5 rounded-xl border border-foreground/15 bg-card p-3.5 transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
  >
    <span className="relative h-20 w-20 flex-none overflow-hidden rounded-lg bg-muted">
      {flight.photo ? (
        <Image
          src={flight.photo}
          alt=""
          fill
          className="object-cover"
          sizes="80px"
        />
      ) : (
        <Plane
          className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground"
          aria-hidden
        />
      )}
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="truncate font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        {flight.airline} · {flight.flightNumber}
      </span>
      <span className="truncate text-[15px] font-semibold leading-snug">
        {flight.origin.name} → {flight.destination.name}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {format(new Date(flight.departure), "MMM d · h:mm a")} ·{" "}
        {formatMoney(flight.price)}
      </span>
      <span className="mt-auto">
        <RatingStars rating={flight.rating} />
      </span>
    </span>
  </Link>
);
