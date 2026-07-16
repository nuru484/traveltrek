// src/components/demo/showcase-logic.ts
//
// Pure decisions for the live-demo showcase — extracted so the
// degrade-when-the-backend-is-down behaviour is unit-testable without
// rendering server components.
import type { IShowcaseData } from "@/lib/public-api";

/**
 * Booking CTAs on showcase cards land on the sign-in page and bounce into
 * the dashboard after auth — loginRedirectPath() only honors /dashboard
 * paths, so the target must live under /dashboard.
 */
export function demoHref(dashboardPath: string): string {
  return `/login?from=${encodeURIComponent(dashboardPath)}`;
}

/** Whether any live inventory arrived (tours/destinations/hotels/flights). */
export function hasLiveInventory(data: IShowcaseData): boolean {
  return (
    data.tours.length > 0 ||
    data.destinations.length > 0 ||
    data.hotels.length > 0 ||
    data.flights.length > 0
  );
}

/** The testimonials band renders only when published reviews exist. */
export function hasTestimonials(data: IShowcaseData): boolean {
  return data.reviews.length > 0;
}

/** "City, Country" — city omitted when the seed left it null. */
export function destinationLine(destination: {
  city: string | null;
  country: string;
}): string {
  return destination.city
    ? `${destination.city}, ${destination.country}`
    : destination.country;
}

/** What a review was about, in one mono-caption line. */
export function reviewTargetLine(target: {
  type: "TOUR" | "ROOM" | "FLIGHT";
  name?: string;
  roomType?: string;
  hotel?: { name: string };
  airline?: string;
  flightNumber?: string;
}): string {
  switch (target.type) {
    case "TOUR":
      return target.name ?? "Tour";
    case "ROOM":
      return target.hotel ? `${target.hotel.name}` : target.roomType ?? "Stay";
    case "FLIGHT":
      return [target.airline, target.flightNumber]
        .filter(Boolean)
        .join(" · ");
  }
}
