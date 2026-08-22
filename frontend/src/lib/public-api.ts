// src/lib/public-api.ts
//
// Server-side fetchers for the unauthenticated /public browse surface — the
// landing page's live showcase sections. Responses are ISR-cached (5
// minutes) and every failure is swallowed into an empty result, so a stopped
// backend can never blank the portfolio page: the sections simply degrade to
// their static fallbacks.
import type { IFlight } from "@/types/flight.types";
import type { IHotel } from "@/types/hotel.types";
import type { IPublicReview } from "@/types/review.types";
import type { ITour } from "@/types/tour.types";

const serverUri = process.env.NEXT_PUBLIC_SERVER_URI;

const REVALIDATE_SECONDS = 300;

/** Public destination DTO (backend toPublicDestinationDTO). */
export interface IPublicDestination {
  id: number;
  name: string;
  city: string | null;
  country: string;
  description: string | null;
  photo: string | null;
}

async function fetchList<T>(path: string): Promise<T[]> {
  if (!serverUri) return [];
  try {
    const response = await fetch(`${serverUri}/api/v1/public${path}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      console.error(
        `Public API: ${path} responded ${String(response.status)}`
      );
      return [];
    }
    const json = (await response.json()) as { data?: T[] };
    return Array.isArray(json.data) ? json.data : [];
  } catch (error) {
    console.error(`Public API: error fetching ${path}:`, error);
    return [];
  }
}

/** Upcoming/ongoing tours, soonest first (the backend's public ordering). */
export function fetchPublicTours(limit = 3): Promise<ITour[]> {
  return fetchList<ITour>(`/tours?limit=${limit}`);
}

export function fetchPublicDestinations(
  limit = 8
): Promise<IPublicDestination[]> {
  return fetchList<IPublicDestination>(`/destinations?limit=${limit}`);
}

export function fetchPublicHotels(limit = 2): Promise<IHotel[]> {
  return fetchList<IHotel>(`/hotels?limit=${limit}`);
}

/** Future SCHEDULED flights only. */
export function fetchPublicFlights(limit = 2): Promise<IFlight[]> {
  return fetchList<IFlight>(`/flights?limit=${limit}`);
}

/** Latest published reviews for the testimonials band. */
export function fetchRecentReviews(limit = 4): Promise<IPublicReview[]> {
  return fetchList<IPublicReview>(`/reviews/recent?limit=${limit}`);
}

/** Everything the landing showcase renders, fetched in parallel. */
export interface IShowcaseData {
  tours: ITour[];
  destinations: IPublicDestination[];
  hotels: IHotel[];
  flights: IFlight[];
  reviews: IPublicReview[];
}

export async function fetchShowcaseData(): Promise<IShowcaseData> {
  const [tours, destinations, hotels, flights, reviews] = await Promise.all([
    fetchPublicTours(),
    fetchPublicDestinations(),
    fetchPublicHotels(),
    fetchPublicFlights(),
    fetchRecentReviews(),
  ]);
  return { tours, destinations, hotels, flights, reviews };
}
