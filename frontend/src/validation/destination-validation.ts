// src/validation/destination-validation.ts
//
// Mirrors backend `createDestinationSchema` / `updateDestinationSchema`
// (backend/src/validations/destination-validation.ts). Keep the two in sync
// when either side's rules change.
import { z } from "zod";

export const destinationFormSchema = z.object({
  name: z.string().min(1, "Destination name is required"),
  description: z.string().optional().nullable(),
  country: z.string().min(1, "Country is required"),
  city: z.string().optional().nullable(),
  destinationPhoto: z.any().optional(),
});

export type IDestinationFormValues = z.infer<typeof destinationFormSchema>;
