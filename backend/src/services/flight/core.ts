// src/services/flight/core.ts
//
// The small shared flight engine: best-effort Cloudinary cleanup and the
// duration derivation both the create and update flows rely on. Built once
// per deps in makeFlightCore(d).
import { MINUTE_MS } from '#services/flight/shared.js';
import { type FlightDeps } from '#services/flight/shared.js';

export type FlightCore = ReturnType<typeof makeFlightCore>;

export const makeFlightCore = (d: FlightDeps) => {
  const { cloudinary, logger } = d;

  /** Best-effort Cloudinary delete; a cleanup failure never fails the request. */
  const cleanupPhoto = async (
    photo: string,
    context: string,
  ): Promise<void> => {
    try {
      await cloudinary.deleteImage(photo);
    } catch (cleanupError) {
      logger.warn({ err: cleanupError, photo }, context);
    }
  };

  const durationMinutes = (departure: Date, arrival: Date): number =>
    Math.round((arrival.getTime() - departure.getTime()) / MINUTE_MS);

  return { cleanupPhoto, durationMinutes };
};
