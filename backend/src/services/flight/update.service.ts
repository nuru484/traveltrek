// src/services/flight/update.service.ts
//
// Flight update (PUT): the field/route/capacity/time guards that read the
// stored flight, seat-inventory re-derivation on a capacity change, and the
// photo replace/remove cleanup. Status here may only move to DELAYED or
// CANCELLED — the state-machine endpoint owns every other transition.
import {
  BookingStatus,
  FlightStatus,
  type Prisma,
} from '#config/prismaClient.js';
import { BadRequestError, NotFoundError } from '#middlewares/error-handler.js';
import { type FlightCore } from '#services/flight/core.js';
import {
  type FlightDeps,
  type FlightUpdateInput,
} from '#services/flight/shared.js';
import {
  flightFullInclude,
  type FlightWithFullRelations,
} from '#utils/mappers/flight.mapper.js';
import { photoColumnValue } from '#utils/photo-removal.js';

export const makeFlightUpdateService = (d: FlightDeps, core: FlightCore) => {
  const { clock, logger, prisma } = d;
  const { cleanupPhoto, durationMinutes } = core;

  const updateFlight = async (
    id: number,
    input: FlightUpdateInput,
  ): Promise<FlightWithFullRelations> => {
    const uploadedPhotoUrl = input.photo;

    try {
      // Previously the express-validator "updateFields" custom check; it lives
      // here because the photo may arrive as a multer file zod cannot see.
      const providedFields = (
        Object.keys(input) as (keyof FlightUpdateInput)[]
      ).filter((key) => input[key] !== undefined);
      if (providedFields.length === 0) {
        throw new BadRequestError(
          'At least one field must be provided for update',
        );
      }

      // PUT may only move status to DELAYED or CANCELLED — checked before any
      // row is fetched, as the legacy handler did. The state-machine endpoint
      // owns every other transition.
      if (
        input.status !== undefined &&
        input.status !== FlightStatus.DELAYED &&
        input.status !== FlightStatus.CANCELLED
      ) {
        throw new BadRequestError(
          'Admin can only update status to DELAYED or CANCELLED. Other statuses are managed automatically.',
        );
      }

      const existingFlight = await prisma.flight.findFirst({
        include: {
          bookings: {
            select: { id: true, status: true },
            where: { deletedAt: null },
          },
        },
        where: { id },
      });
      if (!existingFlight) throw new NotFoundError('Flight not found');

      // Previously validation-chain custom checks that read the stored flight
      // for fallbacks; kept verbatim, message included.
      if (input.originId !== undefined || input.destinationId !== undefined) {
        const effectiveOriginId = input.originId ?? existingFlight.originId;
        const effectiveDestinationId =
          input.destinationId ?? existingFlight.destinationId;
        if (effectiveOriginId === effectiveDestinationId) {
          throw new BadRequestError('Origin and destination must be different');
        }
      }
      if (input.arrival !== undefined) {
        const effectiveDeparture = input.departure ?? existingFlight.departure;
        if (durationMinutes(effectiveDeparture, input.arrival) < 30) {
          throw new BadRequestError(
            'Arrival time must be at least 30 minutes after departure',
          );
        }
      }

      const oldPhoto = existingFlight.photo;
      const bookedSeats =
        existingFlight.capacity - existingFlight.seatsAvailable;
      const hasBookings = existingFlight.bookings.length > 0;
      const hasActiveBookings = existingFlight.bookings.some(
        (b) =>
          b.status === BookingStatus.CONFIRMED ||
          b.status === BookingStatus.PENDING,
      );

      if (
        existingFlight.status === FlightStatus.DEPARTED ||
        existingFlight.status === FlightStatus.LANDED
      ) {
        throw new BadRequestError(
          `Cannot update flight with status ${existingFlight.status}. Flight has already departed or landed.`,
        );
      }

      if (existingFlight.status === FlightStatus.DELAYED) {
        const allowedUpdatesForDelayed = ['arrival', 'departure', 'status'];
        // The photo is exempt, as the legacy check exempted flightPhoto.
        const invalidUpdates = providedFields.filter(
          (key) => key !== 'photo' && !allowedUpdatesForDelayed.includes(key),
        );
        if (invalidUpdates.length > 0) {
          throw new BadRequestError(
            `Flight is DELAYED. Only status and time updates are allowed. Cannot update: ${invalidUpdates.join(', ')}`,
          );
        }
      }

      if (input.status === FlightStatus.CANCELLED && hasActiveBookings) {
        logger.warn(
          `Cancelling flight ${existingFlight.flightNumber} with ${existingFlight.bookings.length} active booking(s). Bookings should be handled separately.`,
        );
        throw new BadRequestError(
          `Cannot cancel flight with ${existingFlight.bookings.length} active booking(s). Please cancel all bookings first.`,
        );
      }

      const now = clock.now();
      const newDeparture = input.departure ?? existingFlight.departure;
      const newArrival = input.arrival ?? existingFlight.arrival;

      if (
        input.departure !== undefined &&
        newDeparture <= now &&
        existingFlight.status === FlightStatus.SCHEDULED
      ) {
        throw new BadRequestError(
          'Departure time must be in the future for scheduled flights',
        );
      }

      if (newArrival <= newDeparture) {
        throw new BadRequestError('Arrival time must be after departure time');
      }

      if (
        hasBookings &&
        (input.originId !== undefined || input.destinationId !== undefined)
      ) {
        if (
          (input.originId !== undefined &&
            input.originId !== existingFlight.originId) ||
          (input.destinationId !== undefined &&
            input.destinationId !== existingFlight.destinationId)
        ) {
          throw new BadRequestError(
            'Cannot change flight route (origin/destination) when bookings exist. Please cancel all bookings first or create a new flight.',
          );
        }
      }

      if (input.capacity !== undefined && input.capacity < bookedSeats) {
        throw new BadRequestError(
          `Cannot reduce capacity to ${input.capacity}. ${bookedSeats} seats are already booked. Minimum capacity allowed is ${bookedSeats}.`,
        );
      }

      if (input.originId !== undefined || input.destinationId !== undefined) {
        const [origin, destination] = await Promise.all([
          input.originId !== undefined
            ? prisma.destination.findFirst({
                select: { id: true },
                where: { id: input.originId },
              })
            : null,
          input.destinationId !== undefined
            ? prisma.destination.findFirst({
                select: { id: true },
                where: { id: input.destinationId },
              })
            : null,
        ]);
        if (
          (input.originId !== undefined && !origin) ||
          (input.destinationId !== undefined && !destination)
        ) {
          throw new NotFoundError('Origin or destination not found');
        }
      }

      // A time change re-derives the stored duration from the effective pair.
      const calculatedDuration =
        input.departure !== undefined || input.arrival !== undefined
          ? durationMinutes(newDeparture, newArrival)
          : undefined;

      if (input.status !== undefined) {
        logger.info(
          `Flight ${existingFlight.flightNumber} status changed from ${existingFlight.status} to ${input.status}`,
        );
      }

      // Prisma ignores undefined keys, so omitted fields stay untouched.
      const data: Prisma.FlightUpdateInput = {
        airline: input.airline,
        arrival: input.arrival === undefined ? undefined : newArrival,
        capacity: input.capacity,
        departure: input.departure === undefined ? undefined : newDeparture,
        destination:
          input.destinationId === undefined
            ? undefined
            : { connect: { id: input.destinationId } },
        duration: calculatedDuration,
        flightClass: input.flightClass,
        flightNumber: input.flightNumber,
        origin:
          input.originId === undefined
            ? undefined
            : { connect: { id: input.originId } },
        photo: photoColumnValue(uploadedPhotoUrl),
        price: input.price,
        // Capacity moves seat inventory with it: booked seats stay booked.
        seatsAvailable:
          input.capacity === undefined
            ? undefined
            : input.capacity - bookedSeats,
        status: input.status,
        stops: input.stops,
      };

      const updatedFlight = await prisma.flight.update({
        data,
        include: flightFullInclude,
        where: { id },
      });

      // Replaced or removed photo: drop the old image now that the row no
      // longer points at it ('' — the removal signal — is covered too).
      if (
        uploadedPhotoUrl !== undefined &&
        oldPhoto &&
        oldPhoto !== uploadedPhotoUrl
      ) {
        await cleanupPhoto(oldPhoto, 'Failed to clean up old flight photo');
      }

      return updatedFlight;
    } catch (error) {
      // Cloudinary upload succeeded but the update was refused: clean up the
      // freshly uploaded image before rethrowing.
      if (uploadedPhotoUrl) {
        await cleanupPhoto(
          uploadedPhotoUrl,
          'Failed to clean up Cloudinary image',
        );
      }
      throw error;
    }
  };

  return { updateFlight };
};
