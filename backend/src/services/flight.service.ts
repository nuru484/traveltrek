// src/services/flight.service.ts
//
// Flights domain logic, extracted from the legacy fat controller. Pure, DI'd
// functions: they take typed inputs, own every Prisma access and domain
// invariant (origin/destination existence, route/capacity guards, the status
// state machine, booking- and payment-aware delete guards, seat accounting,
// Cloudinary photo cleanup), throw the typed CustomError subclasses and never
// touch req/res.
//
// Seat accounting note: bookedSeats = capacity - seatsAvailable; a capacity
// update re-derives seatsAvailable as newCapacity - bookedSeats, and creates
// start with seatsAvailable = capacity. Preserved from the legacy handlers.
//
// Role enforcement note: the legacy handlers re-checked req.user.role inline
// (ADMIN/AGENT gates on status/delete). Those duplicates were deliberately
// dropped in this refactor — routes/flight.ts already enforces roles via
// authorizeRole, which is the single authorization boundary.
import type { IUser } from '../../types/user-profile.types';

import { HTTP_STATUS_CODES } from '../config/constants';
import {
  BookingStatus,
  FlightStatus,
  PaymentStatus,
  type Prisma,
} from '../config/prismaClient';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
} from '../middlewares/error-handler';
import {
  flightFullInclude,
  flightSummaryInclude,
  type FlightWithFullRelations,
  type FlightWithSummaryRelations,
} from '../utils/mappers/flight.mapper';
import { type AppDeps, defaultDeps } from './deps';

/**
 * Whitelisted `sortBy` fields for flight listings — the columns the legacy
 * search validation allowed.
 */
export const FLIGHT_SORT_FIELDS = [
  'airline',
  'arrival',
  'createdAt',
  'departure',
  'duration',
  'flightNumber',
  'price',
] as const;

export type FlightActor = Pick<IUser, 'id' | 'role'>;

export interface FlightDeleteSummary {
  deletedAt: string;
  flightNumber: string;
  id: number;
  status: FlightStatus;
}

export interface FlightInput {
  airline: string;
  arrival: Date;
  capacity: number;
  departure: Date;
  destinationId: number;
  flightClass: string;
  flightNumber: string;
  originId: number;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  photo?: string;
  price: number;
  stops?: number;
}

export interface FlightListParams {
  airline?: string;
  /** Raw date strings, parsed here the way the legacy handler did. */
  departureFrom?: string;
  departureTo?: string;
  destinationId?: number;
  flightClass?: string;
  limit: number;
  maxDuration?: number;
  maxPrice?: number;
  maxStops?: number;
  minPrice?: number;
  minSeats?: number;
  originId?: number;
  page: number;
  search?: string;
  sortBy: FlightSortField;
  sortOrder: 'asc' | 'desc';
}

export type FlightSortField = (typeof FLIGHT_SORT_FIELDS)[number];

/**
 * PATCH /flights/:id/status payload. Times stay raw strings: the DELAYED path
 * parses and rejects them with the legacy messages.
 */
export interface FlightStatusChangeInput {
  arrival?: string;
  departure?: string;
  status: FlightStatus;
}

export interface FlightUpdateInput extends Partial<FlightInput> {
  /** A PUT may only set DELAYED or CANCELLED; the state machine owns the rest. */
  status?: FlightStatus;
}

/** Statuses that block a single-flight delete (and count against bulk deletes). */
const NON_DELETABLE_STATUSES: FlightStatus[] = [
  FlightStatus.DEPARTED,
  FlightStatus.LANDED,
  FlightStatus.DELAYED,
];

const MINUTE_MS = 1000 * 60;

export const makeFlightService = (
  d: Pick<AppDeps, 'clock' | 'cloudinary' | 'logger' | 'prisma'>,
) => {
  const { clock, cloudinary, logger, prisma } = d;

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

  const createFlight = async (
    input: FlightInput,
  ): Promise<FlightWithFullRelations> => {
    try {
      const [origin, destination] = await Promise.all([
        prisma.destination.findUnique({
          select: { id: true },
          where: { id: input.originId },
        }),
        prisma.destination.findUnique({
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

      // flightNumber uniqueness stays a DB constraint (as before); a duplicate
      // surfaces as a Prisma P2002 handled by the central error middleware.
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

  const getFlightById = async (
    id: number,
  ): Promise<FlightWithSummaryRelations> => {
    const flight = await prisma.flight.findUnique({
      include: flightSummaryInclude,
      where: { id },
    });
    if (!flight) throw new NotFoundError('Flight not found');
    return flight;
  };

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

      const existingFlight = await prisma.flight.findUnique({
        include: { bookings: { select: { id: true, status: true } } },
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
            ? prisma.destination.findUnique({
                select: { id: true },
                where: { id: input.originId },
              })
            : null,
          input.destinationId !== undefined
            ? prisma.destination.findUnique({
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
        photo: uploadedPhotoUrl,
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

      // Replaced photo: drop the old image now that the row points elsewhere.
      if (uploadedPhotoUrl && oldPhoto && oldPhoto !== uploadedPhotoUrl) {
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

  const buildWhere = (params: FlightListParams): Prisma.FlightWhereInput => {
    const where: Prisma.FlightWhereInput = {};

    if (params.search) {
      where.OR = [
        { flightNumber: { contains: params.search, mode: 'insensitive' } },
        { airline: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.airline) {
      where.airline = { contains: params.airline, mode: 'insensitive' };
    }

    if (params.originId !== undefined) {
      where.originId = params.originId;
    }

    if (params.destinationId !== undefined) {
      where.destinationId = params.destinationId;
    }

    if (params.flightClass) {
      where.flightClass = params.flightClass;
    }

    if (params.departureFrom || params.departureTo) {
      where.departure = {
        ...(params.departureFrom && { gte: new Date(params.departureFrom) }),
        ...(params.departureTo && { lte: new Date(params.departureTo) }),
      };
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.price = {
        ...(params.minPrice !== undefined && { gte: params.minPrice }),
        ...(params.maxPrice !== undefined && { lte: params.maxPrice }),
      };
    }

    if (params.maxDuration !== undefined) {
      where.duration = { lte: params.maxDuration };
    }

    if (params.maxStops !== undefined) {
      where.stops = { lte: params.maxStops };
    }

    if (params.minSeats !== undefined) {
      where.seatsAvailable = { gte: params.minSeats };
    }

    return where;
  };

  const listFlights = async (
    params: FlightListParams,
  ): Promise<{ flights: FlightWithSummaryRelations[]; total: number }> => {
    const where = buildWhere(params);
    const orderBy: Prisma.FlightOrderByWithRelationInput = {
      [params.sortBy]: params.sortOrder,
    };

    const [flights, total] = await Promise.all([
      prisma.flight.findMany({
        include: flightSummaryInclude,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.flight.count({ where }),
    ]);

    return { flights, total };
  };

  /**
   * Status state machine. Allowed transitions (everything else is refused):
   * SCHEDULED → DEPARTED (departure time reached; departure snapped to now),
   * SCHEDULED → DELAYED (both new times required, later than the original),
   * SCHEDULED → CANCELLED (no bookings at all),
   * DELAYED   → DEPARTED / CANCELLED / SCHEDULED,
   * DEPARTED  → LANDED (arrival time reached; arrival snapped to now),
   * CANCELLED → SCHEDULED (original departure still in the future);
   * LANDED is terminal.
   */
  const updateFlightStatus = async (
    actor: FlightActor,
    id: number,
    change: FlightStatusChangeInput,
  ): Promise<FlightWithFullRelations> => {
    const existingFlight = await prisma.flight.findUnique({
      include: { bookings: { include: { payment: true } } },
      where: { id },
    });
    if (!existingFlight) throw new NotFoundError('Flight not found');

    const currentStatus = existingFlight.status;
    const newStatus = change.status;

    if (newStatus === currentStatus) {
      throw new BadRequestError('New status is the same as current status');
    }

    const now = clock.now();
    const originalDeparture = new Date(existingFlight.departure);
    const originalArrival = new Date(existingFlight.arrival);

    let isValidTransition = false;
    let setDepartureToNow = false;
    let setArrivalToNow = false;

    if (currentStatus === FlightStatus.SCHEDULED) {
      if (newStatus === FlightStatus.DEPARTED) {
        if (originalDeparture > now) {
          throw new BadRequestError(
            `Cannot mark flight as DEPARTED. The scheduled departure time is ${String(originalDeparture)} which is still in the future.`,
          );
        }
        isValidTransition = true;
        setDepartureToNow = true;
      } else if (
        newStatus === FlightStatus.DELAYED ||
        newStatus === FlightStatus.CANCELLED
      ) {
        isValidTransition = true;
      }
    } else if (currentStatus === FlightStatus.DELAYED) {
      if (newStatus === FlightStatus.DEPARTED) {
        if (originalDeparture > now) {
          throw new BadRequestError(
            `Cannot mark flight as DEPARTED. The delayed departure time is ${String(originalDeparture)} which is still in the future.`,
          );
        }
        isValidTransition = true;
        setDepartureToNow = true;
      } else if (
        newStatus === FlightStatus.CANCELLED ||
        newStatus === FlightStatus.SCHEDULED
      ) {
        isValidTransition = true;
      }
    } else if (currentStatus === FlightStatus.DEPARTED) {
      if (newStatus === FlightStatus.LANDED) {
        if (originalArrival > now) {
          throw new BadRequestError(
            `Cannot mark flight as LANDED. The scheduled arrival time is ${String(originalArrival)} which is still in the future.`,
          );
        }
        isValidTransition = true;
        setArrivalToNow = true;
      }
    } else if (currentStatus === FlightStatus.CANCELLED) {
      if (newStatus === FlightStatus.SCHEDULED) {
        if (originalDeparture < now) {
          throw new BadRequestError(
            `Cannot reschedule cancelled flight. The original departure time of ${String(originalDeparture)} has already passed. Please create a new flight instead.`,
          );
        }
        isValidTransition = true;
      }
    } else {
      // currentStatus === LANDED
      throw new BadRequestError(
        'Cannot change status of a flight that has already landed.',
      );
    }

    if (!isValidTransition) {
      throw new BadRequestError(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Please follow proper flight status workflow.`,
      );
    }

    if (newStatus === FlightStatus.CANCELLED) {
      const hasCompletedPayments = existingFlight.bookings.some(
        (b) => b.payment?.status === PaymentStatus.COMPLETED,
      );
      if (hasCompletedPayments) {
        throw new BadRequestError(
          'Cannot cancel flight with completed payments. Please process refunds first.',
        );
      }

      const hasConfirmedBookings = existingFlight.bookings.some(
        (b) => b.status === BookingStatus.CONFIRMED,
      );
      if (hasConfirmedBookings) {
        throw new BadRequestError(
          'Cannot cancel flight with confirmed bookings. Please cancel all confirmed bookings first.',
        );
      }

      if (existingFlight.bookings.length > 0) {
        throw new BadRequestError(
          'Cannot cancel flight with existing bookings. Please cancel all bookings first.',
        );
      }
    }

    if (
      newStatus !== FlightStatus.DELAYED &&
      (change.departure || change.arrival)
    ) {
      throw new BadRequestError(
        'Time updates are only allowed when setting status to DELAYED.',
      );
    }

    let newDeparture = existingFlight.departure;
    let newArrival = existingFlight.arrival;
    let calculatedDuration = existingFlight.duration;

    if (newStatus === FlightStatus.DELAYED) {
      if (!change.departure || !change.arrival) {
        throw new BadRequestError(
          'For DELAYED status, both updated departure and arrival times are required.',
        );
      }

      newDeparture = new Date(change.departure);
      newArrival = new Date(change.arrival);

      if (isNaN(newDeparture.getTime()) || isNaN(newArrival.getTime())) {
        throw new BadRequestError(
          'Invalid date format for departure or arrival time.',
        );
      }

      if (newDeparture <= now) {
        throw new BadRequestError(
          'Delayed departure time must be in the future.',
        );
      }

      if (newArrival <= newDeparture) {
        throw new BadRequestError('Arrival time must be after departure time.');
      }

      if (newDeparture <= originalDeparture) {
        throw new BadRequestError(
          'Delayed departure time must be later than the original scheduled departure.',
        );
      }

      calculatedDuration = durationMinutes(newDeparture, newArrival);

      if (calculatedDuration < 10) {
        throw new BadRequestError(
          'Flight duration cannot be less than 10 minutes.',
        );
      }

      if (calculatedDuration > 1440) {
        throw new BadRequestError('Flight duration cannot exceed 24 hours.');
      }
    } else {
      if (setDepartureToNow) newDeparture = now;
      if (setArrivalToNow) newArrival = now;

      if (setDepartureToNow || setArrivalToNow) {
        if (newArrival <= newDeparture) {
          throw new BadRequestError(
            'Arrival time must be after departure time.',
          );
        }
        calculatedDuration = durationMinutes(newDeparture, newArrival);
      }
    }

    const data: Prisma.FlightUpdateInput = { status: newStatus };
    if (newDeparture.getTime() !== existingFlight.departure.getTime()) {
      data.departure = newDeparture;
    }
    if (newArrival.getTime() !== existingFlight.arrival.getTime()) {
      data.arrival = newArrival;
    }
    if (calculatedDuration !== existingFlight.duration) {
      data.duration = calculatedDuration;
    }

    const updatedFlight = await prisma.flight.update({
      data,
      include: flightFullInclude,
      where: { id },
    });

    logger.info(
      `Flight ${existingFlight.flightNumber} status changed from ${currentStatus} to ${newStatus} by ${actor.role} user ${actor.id}`,
    );

    // Cancelling cascades to the flight's active bookings, releasing them.
    // (With the guards above, a flight only reaches CANCELLED bookingless, so
    // this is a safety net — preserved from the legacy handler.)
    if (newStatus === FlightStatus.CANCELLED) {
      await prisma.booking.updateMany({
        data: { status: BookingStatus.CANCELLED },
        where: {
          flightId: id,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
      });

      logger.info(
        `Auto-cancelled all active bookings for flight ${existingFlight.flightNumber}`,
      );
    }

    return updatedFlight;
  };

  /**
   * Deletes one flight after the legacy guard chain, in order: non-deletable
   * status (DEPARTED/LANDED/DELAYED), active bookings, then bookings holding
   * COMPLETED/PENDING payment records. Historical bookings never block, they
   * are only logged (they survive as orphans).
   */
  const deleteFlight = async (id: number): Promise<FlightDeleteSummary> => {
    const flight = await prisma.flight.findUnique({
      include: {
        bookings: {
          select: {
            id: true,
            payment: { select: { amount: true, id: true, status: true } },
            status: true,
          },
        },
      },
      where: { id },
    });
    if (!flight) throw new NotFoundError('Flight not found');

    if (NON_DELETABLE_STATUSES.includes(flight.status)) {
      throw new BadRequestError(
        `Cannot delete flight with status ${flight.status}. Only SCHEDULED or CANCELLED flights can be deleted.`,
      );
    }

    const activeBookings = flight.bookings.filter(
      (booking) =>
        booking.status === BookingStatus.CONFIRMED ||
        booking.status === BookingStatus.PENDING,
    );
    if (activeBookings.length > 0) {
      throw new BadRequestError(
        `Cannot delete flight with ${activeBookings.length} active booking(s). Please cancel all bookings first.`,
      );
    }

    const bookingsWithPayments = flight.bookings.filter(
      (booking) =>
        booking.payment &&
        (booking.payment.status === PaymentStatus.COMPLETED ||
          booking.payment.status === PaymentStatus.PENDING),
    );
    if (bookingsWithPayments.length > 0) {
      const totalAmount = bookingsWithPayments.reduce(
        (sum, booking) => sum + (booking.payment?.amount ?? 0),
        0,
      );

      throw new BadRequestError(
        `Cannot delete flight with ${bookingsWithPayments.length} booking(s) that have payment records ` +
          `(${bookingsWithPayments.filter((b) => b.payment?.status === PaymentStatus.COMPLETED).length} completed, ` +
          `${bookingsWithPayments.filter((b) => b.payment?.status === PaymentStatus.PENDING).length} pending). ` +
          `Total amount: ${totalAmount.toFixed(2)}. ` +
          `Please process refunds for all payments before deleting this flight.`,
      );
    }

    // Historical bookings survive the delete for record-keeping.
    const historicalBookings = flight.bookings.filter(
      (booking) =>
        (booking.status === BookingStatus.COMPLETED ||
          booking.status === BookingStatus.CANCELLED) &&
        (!booking.payment ||
          booking.payment.status === PaymentStatus.REFUNDED ||
          booking.payment.status === PaymentStatus.FAILED),
    );
    if (historicalBookings.length > 0) {
      logger.warn(
        `Deleting flight ${flight.flightNumber} (ID: ${id}) with ${historicalBookings.length} historical booking(s). Bookings will be orphaned.`,
      );
    }

    await prisma.flight.delete({ where: { id } });

    if (flight.photo) {
      try {
        await cloudinary.deleteImage(flight.photo);
        logger.info(
          `Successfully deleted photo for flight ${flight.flightNumber}`,
        );
      } catch (cleanupError) {
        logger.warn(
          { err: cleanupError },
          `Failed to clean up flight photo from Cloudinary for flight ${flight.flightNumber}`,
        );
      }
    }

    logger.info(
      `Flight deleted successfully - ID: ${id}, Number: ${flight.flightNumber}, Status: ${flight.status}`,
    );

    return {
      deletedAt: clock.now().toISOString(),
      flightNumber: flight.flightNumber,
      id: flight.id,
      status: flight.status,
    };
  };

  /**
   * Wipes every flight, but only when NONE of them has a blocking condition
   * (non-deletable status, pending/confirmed bookings, completed/pending
   * payments); a single blocked flight refuses the whole operation with a 409
   * summarising every issue. Returns the deleted count.
   */
  const deleteAllFlights = async (): Promise<number> => {
    const flightCount = await prisma.flight.count();
    if (flightCount === 0) {
      throw new BadRequestError('No flights to delete');
    }

    const flights = await prisma.flight.findMany({
      include: { bookings: { include: { payment: true } } },
    });

    const flightsWithNonDeletableStatus: number[] = [];
    const flightsWithPendingBookings: number[] = [];
    const flightsWithConfirmedBookings: number[] = [];
    const flightsWithCompletedPayments: number[] = [];
    const flightsWithPendingPayments: number[] = [];

    for (const flight of flights) {
      if (NON_DELETABLE_STATUSES.includes(flight.status)) {
        flightsWithNonDeletableStatus.push(flight.id);
      }
      if (flight.bookings.some((b) => b.status === BookingStatus.PENDING)) {
        flightsWithPendingBookings.push(flight.id);
      }
      if (flight.bookings.some((b) => b.status === BookingStatus.CONFIRMED)) {
        flightsWithConfirmedBookings.push(flight.id);
      }
      if (
        flight.bookings.some(
          (b) => b.payment?.status === PaymentStatus.COMPLETED,
        )
      ) {
        flightsWithCompletedPayments.push(flight.id);
      }
      if (
        flight.bookings.some(
          (b) => b.payment?.status === PaymentStatus.PENDING,
        )
      ) {
        flightsWithPendingPayments.push(flight.id);
      }
    }

    const blockingIssues: string[] = [];

    if (flightsWithNonDeletableStatus.length > 0) {
      blockingIssues.push(
        `${flightsWithNonDeletableStatus.length} flight${flightsWithNonDeletableStatus.length > 1 ? 's' : ''} with non-deletable status (DEPARTED, LANDED, or DELAYED)`,
      );
    }
    if (flightsWithPendingBookings.length > 0) {
      blockingIssues.push(
        `${flightsWithPendingBookings.length} flight${flightsWithPendingBookings.length > 1 ? 's' : ''} with pending bookings`,
      );
    }
    if (flightsWithConfirmedBookings.length > 0) {
      blockingIssues.push(
        `${flightsWithConfirmedBookings.length} flight${flightsWithConfirmedBookings.length > 1 ? 's' : ''} with confirmed bookings`,
      );
    }
    if (flightsWithCompletedPayments.length > 0) {
      blockingIssues.push(
        `${flightsWithCompletedPayments.length} flight${flightsWithCompletedPayments.length > 1 ? 's' : ''} with completed payments`,
      );
    }
    if (flightsWithPendingPayments.length > 0) {
      blockingIssues.push(
        `${flightsWithPendingPayments.length} flight${flightsWithPendingPayments.length > 1 ? 's' : ''} with pending payments`,
      );
    }

    if (blockingIssues.length > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete flights: ${blockingIssues.join(', ')} must be cancelled or resolved first`,
      );
    }

    const photos = flights
      .map((flight) => flight.photo)
      .filter((photo): photo is string => Boolean(photo));

    await prisma.flight.deleteMany({});

    // Clean up photos from Cloudinary after the successful deletion.
    await Promise.allSettled(
      photos.map((photo) =>
        cleanupPhoto(photo, `Failed to clean up photo ${photo}`),
      ),
    );

    return flights.length;
  };

  /** Aggregated dashboard numbers, ported verbatim from the legacy handler. */
  const getFlightStats = async () => {
    const now = clock.now();

    const [
      totalFlights,
      totalSeats,
      totalBookedSeats,
      averagePrice,
      flightsByClass,
      flightsByAirline,
      flightsByStatus,
      scheduledFlights,
      departedFlights,
      landedFlights,
      delayedFlights,
      cancelledFlights,
      upcomingFlights,
      totalRevenue,
      flightsWithBookings,
    ] = await Promise.all([
      prisma.flight.count(),
      prisma.flight.aggregate({ _sum: { seatsAvailable: true } }),
      prisma.flight.aggregate({ _sum: { capacity: true } }),
      prisma.flight.aggregate({ _avg: { price: true } }),
      prisma.flight.groupBy({
        _count: true,
        by: ['flightClass'],
        orderBy: { _count: { flightClass: 'desc' } },
      }),
      prisma.flight.groupBy({
        _count: true,
        by: ['airline'],
        orderBy: { _count: { airline: 'desc' } },
        take: 10,
      }),
      prisma.flight.groupBy({
        _count: true,
        _sum: { capacity: true, seatsAvailable: true },
        by: ['status'],
      }),
      prisma.flight.count({ where: { status: FlightStatus.SCHEDULED } }),
      prisma.flight.count({ where: { status: FlightStatus.DEPARTED } }),
      prisma.flight.count({ where: { status: FlightStatus.LANDED } }),
      prisma.flight.count({ where: { status: FlightStatus.DELAYED } }),
      prisma.flight.count({ where: { status: FlightStatus.CANCELLED } }),
      prisma.flight.count({
        where: {
          departure: { gte: now },
          status: FlightStatus.SCHEDULED,
        },
      }),
      prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: {
          flightId: { not: null },
          payment: { status: PaymentStatus.COMPLETED },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
      }),
      prisma.flight.count({
        where: {
          bookings: {
            some: {
              status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
            },
          },
        },
      }),
    ]);

    const totalCapacity = totalBookedSeats._sum.capacity ?? 0;
    const totalAvailable = totalSeats._sum.seatsAvailable ?? 0;
    const totalBooked = totalCapacity - totalAvailable;
    const occupancyRate =
      totalCapacity > 0
        ? ((totalBooked / totalCapacity) * 100).toFixed(2)
        : '0.00';
    const revenue = totalRevenue._sum.totalPrice ?? 0;

    const statusBreakdown = flightsByStatus.map((item) => {
      const capacity = item._sum.capacity ?? 0;
      const available = item._sum.seatsAvailable ?? 0;
      const booked = capacity - available;
      const rate =
        capacity > 0 ? ((booked / capacity) * 100).toFixed(2) : '0.00';

      return {
        count: item._count,
        occupancyRate: `${rate}%`,
        seatsAvailable: available,
        seatsBooked: booked,
        status: item.status,
        totalCapacity: capacity,
      };
    });

    return {
      byClass: flightsByClass.map((item) => ({
        class: item.flightClass,
        count: item._count,
      })),

      byStatus: {
        cancelled: cancelledFlights,
        delayed: delayedFlights,
        departed: departedFlights,
        detailed: statusBreakdown,
        landed: landedFlights,
        scheduled: scheduledFlights,
        upcoming: upcomingFlights,
      },

      financialMetrics: {
        averageBookingValue:
          flightsWithBookings > 0
            ? Math.round((revenue / flightsWithBookings) * 100) / 100
            : 0,
        revenuePerSeat:
          totalBooked > 0 ? Math.round((revenue / totalBooked) * 100) / 100 : 0,
        totalRevenue: Math.round(revenue * 100) / 100,
      },

      operationalMetrics: {
        cancellationRate:
          totalFlights > 0
            ? `${((cancelledFlights / totalFlights) * 100).toFixed(2)}%`
            : '0.00%',
        cancelledFlights,
        completedFlights: landedFlights,
        completionRate:
          totalFlights > 0
            ? `${((landedFlights / totalFlights) * 100).toFixed(2)}%`
            : '0.00%',
        delayedFlights,
        delayRate:
          totalFlights > 0
            ? `${((delayedFlights / totalFlights) * 100).toFixed(2)}%`
            : '0.00%',
        onTimeFlights: scheduledFlights + departedFlights,
      },

      overview: {
        averagePrice: Math.round((averagePrice._avg.price ?? 0) * 100) / 100,
        flightsWithBookings,
        occupancyRate: `${occupancyRate}%`,
        totalCapacity,
        totalFlights,
        totalRevenue: Math.round(revenue * 100) / 100,
        totalSeatsAvailable: totalAvailable,
        totalSeatsBooked: totalBooked,
      },

      topAirlines: flightsByAirline.map((item) => ({
        airline: item.airline,
        count: item._count,
      })),
    };
  };

  return {
    createFlight,
    deleteAllFlights,
    deleteFlight,
    getFlightById,
    getFlightStats,
    listFlights,
    updateFlight,
    updateFlightStatus,
  };
};

export const flightService = makeFlightService(defaultDeps);

export const {
  createFlight,
  deleteAllFlights,
  deleteFlight,
  getFlightById,
  getFlightStats,
  listFlights,
  updateFlight,
  updateFlightStatus,
} = flightService;
