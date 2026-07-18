// src/validation/room-validation.ts
//
// Mirrors backend `createRoomSchema` / `updateRoomSchema`
// (backend/src/validations/room-validation.ts). Keep the two in sync when
// either side's rules change.
import { z } from "zod";

export const roomFormSchema = z.object({
  hotelId: z.number().min(1, "Hotel is required"),
  roomType: z.string().min(1, "Room type is required"),
  // GHS decimal in the form; converted to integer pesewas (×100) on submit
  // and back (÷100) when hydrating edit defaults.
  pricePerNight: z.number().min(0, "Price must be a positive number"),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  totalRooms: z.number().min(1, "Total rooms must be at least 1"),
  description: z.string().optional().nullable(),
  amenities: z.array(z.string()).optional(),
  roomPhoto: z.any().optional(),
});

export type IRoomFormValues = z.infer<typeof roomFormSchema>;
