// The live inventory: tours, destinations, hotels and flights from the
// public API, each band rendering only when its data arrived. When the
// backend is down the whole page degrades to the board's "demo idle" note
// plus this one explanatory card.
import Link from "next/link";
import type { IShowcaseData } from "@/lib/public-api";
import {
  DestinationChip,
  Eyebrow,
  FlightCard,
  HotelCard,
  TourCard,
} from "./showcase-cards";
import { demoHref, hasLiveInventory } from "./showcase-logic";

const LiveInventory = ({ data }: { data: IShowcaseData }) => {
  const live = hasLiveInventory(data);

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        {!live && (
          <div className="rounded-xl border border-dashed border-foreground/25 bg-card/60 p-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Demo idle
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              The demo backend isn&apos;t reachable right now, so there&apos;s
              nothing at the gate. Check back shortly — the board refreshes
              itself every five minutes.
            </p>
          </div>
        )}

        {data.tours.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between gap-4 border-b border-foreground/15 pb-2">
              <Eyebrow>Departing soon · Tours</Eyebrow>
              <Link
                href={demoHref("/dashboard/tours")}
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:text-foreground"
              >
                Browse all
              </Link>
            </div>
            <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.tours.map((tour) => (
                <li key={tour.id}>
                  <TourCard tour={tour} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.destinations.length > 0 && (
          <div className="mt-14 first:mt-0">
            <div className="border-b border-foreground/15 pb-2">
              <Eyebrow>On the route map · Destinations</Eyebrow>
            </div>
            <ul className="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-1">
              {data.destinations.map((destination) => (
                <DestinationChip
                  key={destination.id}
                  destination={destination}
                />
              ))}
            </ul>
          </div>
        )}

        {(data.hotels.length > 0 || data.flights.length > 0) && (
          <div className="mt-14 first:mt-0">
            <div className="border-b border-foreground/15 pb-2">
              <Eyebrow>Also on the board · Hotels &amp; flights</Eyebrow>
            </div>
            <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data.hotels.map((hotel) => (
                <li key={`hotel-${hotel.id}`}>
                  <HotelCard hotel={hotel} />
                </li>
              ))}
              {data.flights.map((flight) => (
                <li key={`flight-${flight.id}`}>
                  <FlightCard flight={flight} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};

export default LiveInventory;
