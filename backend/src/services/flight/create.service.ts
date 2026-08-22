// src/services/flight/create.service.ts
//
// Flight creation: origin/destination existence + duration guard, then the
// insert (seatsAvailable seeded to capacity). A refused create reclaims the
// already-uploaded photo.
import { BadRequestError, NotFoundError } from '#middlewares/error-handler.js';
import { type FlightCore } from '#services/flight/core.js';
import {
  type FlightDeps,
  type FlightInput,
} from '#services/flight/shared.js';
import {
  flightFullInclude,
  type FlightWithFullRelations,
} from '#utils/mappers/flight.mapper.js';

export const makeFlightCreateService = (d: FlightDeps, core: FlightCore) => {
  const { prisma } = d;
  const { cleanupPhoto, durationMinutes } = core;

  const createFlight = async (
    input: FlightInput,
  ): Promise<FlightWithFullRelations> => {
    try {
      // findFirst so soft-deleted destinations cannot host new flights.
      const [origin, destination] = await Promise.all([
        prisma.destination.findFirst({
          select: { id: true },
          where: { id: input.originId },
        }),
        prisma.destination.findFirst({
          select: { id: true },
          where: { id: input.destinationId },
        }),
      ]);
      if (!origin || !destination) {
        throw new NotFoundError('Origin or destination not found');
      }

      const duration = durationMinutes(input.departure, input.arrival);
      if (duration <= 0) {
        throw new BadRequestError('Arrival time must be after departure time');
      }

      // flightNumber uniqueness is a DB constraint; a duplicate surfaces as a
      // Prisma P2002 handled by the central error middleware. Note: the
      // constraint spans soft-deleted rows too, so a soft-deleted flight keeps
      // holding its flightNumber.
      return await prisma.flight.create({
        data: {
          airline: input.airline,
          arrival: input.arrival,
          capacity: input.capacity,
          departure: input.departure,
          destination: { connect: { id: input.destinationId } },
          duration,
          flightClass: input.flightClass,
          flightNumber: input.flightNumber,
          origin: { connect: { id: input.originId } },
          photo: input.photo ?? null,
          price: input.price,
          seatsAvailable: input.capacity,
          stops: input.stops ?? 0,
        },
        include: flightFullInclude,
      });
    } catch (error) {
      // The photo was already uploaded by the route middleware; don't orphan
      // it on Cloudinary when the create is refused.
      if (input.photo) {
        await cleanupPhoto(input.photo, 'Failed to clean up Cloudinary image');
      }
      throw error;
    }
  };

  return { createFlight };
};
