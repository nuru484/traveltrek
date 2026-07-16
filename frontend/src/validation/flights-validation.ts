import { z } from "zod";
import { IFlightClass } from "@/types/flight.types";

export const flightFormSchema = z.object({
  flightNumber: z
    .string()
    .min(1, "Flight number is required")
    .max(15, "Flight number must be 15 characters or less"),
  airline: z
    .string()
    .min(1, "Airline is required")
    .max(60, "Airline must be 60 characters or less"),
  departure: z.string().min(1, "Departure date is required"),
  arrival: z.string().min(1, "Arrival date is required"),
  originId: z.number().min(1, "Origin is required"),
  destinationId: z.number().min(1, "Destination is required"),
  // GHS decimal in the form (converted to integer pesewas ×100 on submit).
  price: z
    .number()
    .min(0, "Price must be a positive number")
    .max(10_000_000, "Price must be 10,000,000 or less"),
  flightClass: z.enum(IFlightClass, {
    message: "Flight class is required",
  }),
  stops: z.number().min(0, "Stops must be a non-negative number").optional(),
  capacity: z
    .number()
    .min(0, "Capacity (Seats Available) must be a non-negative number"),
  flightPhoto: z.any().optional(),
});

export type IFlightFormValues = z.infer<typeof flightFormSchema>;
