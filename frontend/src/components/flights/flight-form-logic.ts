// src/components/flights/flight-form-logic.ts
//
// Pure helpers behind the flight form: default values, datetime-local
// formatting, combobox display text and the multipart payload assembly. Kept
// free of React so they can be unit-tested directly.
import type { IDestination } from "@/types/destination.types";
import type { IFlight } from "@/types/flight.types";
import { IFlightClass } from "@/types/flight.types";
import type { IFlightFormValues } from "@/validation/flights-validation";

/** ISO timestamp -> the "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
export const toDatetimeLocalValue = (iso?: string): string =>
  iso ? iso.split("T")[0] + "T" + iso.split("T")[1].slice(0, 5) : "";

export const flightFormDefaults = (flight?: IFlight): IFlightFormValues => ({
  flightNumber: flight?.flightNumber || "",
  airline: flight?.airline || "",
  departure: toDatetimeLocalValue(flight?.departure),
  arrival: toDatetimeLocalValue(flight?.arrival),
  originId: flight?.origin?.id || 0,
  destinationId: flight?.destination?.id || 0,
  // API price is integer pesewas; the form edits GHS decimals.
  price: flight ? flight.price / 100 : 0,
  flightClass: flight?.flightClass || IFlightClass.ECONOMY,
  stops: flight?.stops || 0,
  capacity: flight?.seatsAvailable || 0,
  flightPhoto: undefined,
});

/**
 * Display text for the origin/destination combobox trigger: the preset (edit
 * mode) wins, then the currently fetched options, then the placeholder.
 */
export const getSelectionDisplayText = (
  id: number,
  preset: { id: number; name: string } | null | undefined,
  options: IDestination[],
  placeholder: string
): string => {
  if (!id) return placeholder;
  if (preset && preset.id === id) return preset.name;
  return options.find((option) => option.id === id)?.name || placeholder;
};

/**
 * Multipart payload for create/update; converts GHS decimals to pesewas.
 * `removePhoto` sends flightPhoto as the empty string — the API's signal to
 * clear the stored photo (a selected file always wins over removal).
 */
export const buildFlightFormData = (
  values: IFlightFormValues,
  options?: { removePhoto?: boolean }
): FormData => {
  const formData = new FormData();
  formData.append("flightNumber", values.flightNumber);
  formData.append("airline", values.airline);
  formData.append("departure", new Date(values.departure).toISOString());
  formData.append("arrival", new Date(values.arrival).toISOString());
  formData.append("originId", values.originId.toString());
  formData.append("destinationId", values.destinationId.toString());
  // GHS decimal -> integer pesewas for the API.
  formData.append("price", Math.round(values.price * 100).toString());
  formData.append("flightClass", values.flightClass);
  if (values.stops !== undefined)
    formData.append("stops", values.stops.toString());
  formData.append("capacity", values.capacity.toString());
  if (values.flightPhoto) {
    formData.append("flightPhoto", values.flightPhoto);
  } else if (options?.removePhoto) {
    formData.append("flightPhoto", "");
  }
  return formData;
};
