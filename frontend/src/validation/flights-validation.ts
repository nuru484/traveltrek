import { z } from "zod";
import { IFlightClass } from "@/types/flight.types";

export const flightFormSchema = z.object({
  flightNumber: z.string().min(1, "Flight number is required"),
  airline: z.string().min(1, "Airline is required"),
  departure: z.string().min(1, "Departure date is required"),
  arrival: z.string().min(1, "Arrival date is required"),
  originId: z.number().min(1, "Origin is required"),
  destinationId: z.number().min(1, "Destination is required"),
  price: z.number().min(0, "Price must be a positive number"),
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
