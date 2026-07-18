// src/validation/hotel-validation.ts
//
// Mirrors backend `createHotelSchema` / `updateHotelSchema`
// (backend/src/validations/hotel-validation.ts). Keep the two in sync when
// either side's rules change.
import { z } from "zod";

export const hotelFormSchema = z.object({
  name: z.string().min(1, "Hotel name is required"),
  description: z.string().optional().nullable(),
  address: z.string().min(1, "Address is required"),
  phone: z.string().optional().nullable(),
  starRating: z.number().min(1).max(5).optional(),
  amenities: z.array(z.string()).optional(),
  destinationId: z.number().min(1, "Destination is required"),
  hotelPhoto: z.any().optional(),
});

export type IHotelFormValues = z.infer<typeof hotelFormSchema>;
