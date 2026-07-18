// src/validation/tour-validation.ts
//
// Mirrors backend `createTourSchema` / `updateTourSchema`
// (backend/src/validations/tour-validation.ts). Keep the two in sync when
// either side's rules change.
import { z } from "zod";

export const tourFormSchema = z.object({
  name: z.string().min(1, "Tour name is required"),
  description: z.string().optional().nullable(),
  type: z.enum(
    ["ADVENTURE", "CULTURAL", "BEACH", "CITY", "WILDLIFE", "CRUISE"],
    {
      message: "Tour type is required",
    }
  ),
  // GHS decimal in the form; converted to integer pesewas (×100) on submit
  // and back (÷100) when hydrating edit defaults.
  price: z.number().min(0, "Price must be a non-negative number"),
  maxGuests: z.number().min(1, "Max guests must be a positive number"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  destinationId: z.number().min(1, "Destination is required"),
  tourPhoto: z.any().optional(),
});

export type ITourFormValues = z.infer<typeof tourFormSchema>;
