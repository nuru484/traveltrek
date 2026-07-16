// src/controllers/flight/flight-controller.ts
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { param } from 'express-validator';
import { IFlight, IFlightInput, IFlightUpdateInput } from 'types/flight.types';

import { FlightStatus } from '../../generated/prisma/client';
import { cloudinaryService } from '../config/claudinary';
import { HTTP_STATUS_CODES } from '../config/constants';
import { CLOUDINARY_UPLOAD_OPTIONS } from '../config/constants';
import multerUpload from '../config/multer';
import prisma from '../config/prismaClient';
import conditionalCloudinaryUpload from '../middlewares/conditional-cloudinary-upload';
import {
  asyncHandler,
  BadRequestError,
  CustomError,
  NotFoundError,
  UnauthorizedError,
} from '../middlewares/error-handler';
import validationMiddleware from '../middlewares/validation';
import logger from '../utils/logger';
import {
  createFlightValidation,
  flightPhotoValidation,
  getFlightsValidation,
  updateFlightStatusValidation,
  updateFlightValidation,
} from '../validations/flight-validation';

/**
 * Create a new flight
 */
const handleCreateFlight = asyncHandler(
  async (
    req: Request<{}, {}, IFlightInput>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const {
      airline,
      arrival,
      capacity,
      departure,
      destinationId,
      flightClass,
      flightNumber,
      originId,
      price,
      stops,
    } = req.body;

    const parsedOriginId = parseInt(String(originId), 10);
    const parsedDestinationId = parseInt(String(destinationId), 10);
    const parsedPrice = parseFloat(String(price));
    const parsedStops = stops ? parseInt(String(stops), 10) : 0;
    const parsedCapacity = parseInt(String(capacity), 10);

    if (isNaN(parsedOriginId) || isNaN(parsedDestinationId)) {
      throw new BadRequestError('Invalid origin or destination ID');
    }

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      throw new BadRequestError('Invalid price');
    }

    if (isNaN(parsedCapacity) || parsedCapacity < 0) {
      throw new BadRequestError('Invalid capacity');
    }

    if (stops !== undefined && isNaN(parsedStops)) {
      throw new BadRequestError('Invalid stops value');
    }

    const [origin, destination] = await Promise.all([
      prisma.destination.findUnique({ where: { id: parsedOriginId } }),
      prisma.destination.findUnique({ where: { id: parsedDestinationId } }),
    ]);

    if (!origin || !destination) {
      throw new NotFoundError('Origin or destination not found');
    }

    const departureDate = new Date(departure);
    const arrivalDate = new Date(arrival);
    const durationInMinutes = Math.round(
      (arrivalDate.getTime() - departureDate.getTime()) / (1000 * 60),
    );

    if (durationInMinutes <= 0) {
      throw new BadRequestError('Arrival time must be after departure time');
    }

    const photoUrl = req.body.flightPhoto;

    const flight = await prisma.flight.create({
      data: {
        airline,
        arrival: arrivalDate,
        capacity: parsedCapacity,
        departure: departureDate,
        destination: { connect: { id: parsedDestinationId } },
        duration: durationInMinutes,
        flightClass,
        flightNumber,
        origin: { connect: { id: parsedOriginId } },
        photo: typeof photoUrl === 'string' ? photoUrl : null,
        price: parsedPrice,
        seatsAvailable: parsedCapacity,
        stops: parsedStops,
      },
      include: {
        destination: true,
        origin: true,
      },
    });

    const response: IFlight = {
      airline: flight.airline,
      arrival: flight.arrival,
      capacity: flight.capacity,
      createdAt: flight.createdAt,
      departure: flight.departure,
      destination: flight.destination,
      duration: flight.duration,
      flightClass: flight.flightClass,
      flightNumber: flight.flightNumber,
      id: flight.id,
      origin: flight.origin,
      photo: flight.photo,
      price: flight.price,
      seatsAvailable: flight.seatsAvailable,
      status: flight.status,
      stops: flight.stops,
      updatedAt: flight.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.CREATED).json({
      data: response,
      message: 'Flight created successfully',
    });
  },
);

export const createFlight: RequestHandler[] = [
  multerUpload.single('flightPhoto'),
  ...validationMiddleware.create([
    createFlightValidation,
    ...flightPhotoValidation,
  ]),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'flightPhoto'),
  handleCreateFlight,
];

/**
 * Get a single flight by ID
 */
const handleGetFlight = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const flight = await prisma.flight.findUnique({
      include: {
        destination: {
          select: {
            city: true,
            country: true,
            id: true,
            name: true,
          },
        },
        origin: {
          select: {
            city: true,
            country: true,
            id: true,
            name: true,
          },
        },
      },
      where: { id: parseInt(id) },
    });

    if (!flight) {
      throw new NotFoundError('Flight not found');
    }

    const response = {
      airline: flight.airline,
      arrival: flight.arrival,
      capacity: flight.capacity,
      createdAt: flight.createdAt,
      departure: flight.departure,
      destination: flight.destination,
      destinationId: flight.destinationId,
      duration: flight.duration,
      flightClass: flight.flightClass,
      flightNumber: flight.flightNumber,
      id: flight.id,
      origin: flight.origin,
      originId: flight.originId,
      photo: flight.photo,
      price: flight.price,
      seatsAvailable: flight.seatsAvailable,
      status: flight.status,
      stops: flight.stops,
      updatedAt: flight.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Flight retrieved successfully',
    });
  },
);

export const getFlight: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Flight ID must be a positive integer'),
  handleGetFlight,
];

/**
 * Update a flight with photo handling
 */
const handleUpdateFlight = asyncHandler(
  async (
    req: Request<{ id?: string }, {}, Partial<IFlightUpdateInput>>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const {
      airline,
      arrival,
      capacity,
      departure,
      destinationId,
      flightClass,
      flightNumber,
      originId,
      price,
      status,
      stops,
    } = req.body;

    const parsedId = parseInt(id!, 10);
    const parsedOriginId =
      originId !== undefined ? parseInt(String(originId), 10) : undefined;
    const parsedDestinationId =
      destinationId !== undefined
        ? parseInt(String(destinationId), 10)
        : undefined;
    const parsedPrice =
      price !== undefined ? parseFloat(String(price)) : undefined;
    const parsedStops =
      stops !== undefined ? parseInt(String(stops), 10) : undefined;
    const parsedCapacity =
      capacity !== undefined ? parseInt(String(capacity), 10) : undefined;

    if (isNaN(parsedId)) {
      throw new BadRequestError('Invalid flight ID');
    }

    if (parsedOriginId !== undefined && isNaN(parsedOriginId)) {
      throw new BadRequestError('Invalid origin ID');
    }

    if (parsedDestinationId !== undefined && isNaN(parsedDestinationId)) {
      throw new BadRequestError('Invalid destination ID');
    }

    if (parsedPrice !== undefined && (isNaN(parsedPrice) || parsedPrice < 0)) {
      throw new BadRequestError('Invalid price');
    }

    if (
      parsedCapacity !== undefined &&
      (isNaN(parsedCapacity) || parsedCapacity < 0)
    ) {
      throw new BadRequestError('Invalid capacity');
    }

    if (parsedStops !== undefined && isNaN(parsedStops)) {
      throw new BadRequestError('Invalid stops value');
    }

    // ✅ Validate status if provided
    if (status !== undefined) {
      const allowedStatuses: FlightStatus[] = ['DELAYED', 'CANCELLED'];
      if (!allowedStatuses.includes(status)) {
        throw new BadRequestError(
          'Admin can only update status to DELAYED or CANCELLED. Other statuses are managed automatically.',
        );
      }
    }

    let uploadedImageUrl: string | undefined;
    let oldPhoto: null | string = null;

    try {
      const existingFlight = await prisma.flight.findUnique({
        include: { bookings: { select: { id: true, status: true } } },
        where: { id: parsedId },
      });

      if (!existingFlight) {
        throw new NotFoundError('Flight not found');
      }

      oldPhoto = existingFlight.photo;
      const bookedSeats =
        existingFlight.capacity - existingFlight.seatsAvailable;
      const hasBookings = existingFlight.bookings.length > 0;
      const hasActiveBookings = existingFlight.bookings.some(
        (b) => b.status === 'CONFIRMED' || b.status === 'PENDING',
      );

      const nonEditableStatuses: FlightStatus[] = ['DEPARTED', 'LANDED'];

      if (nonEditableStatuses.includes(existingFlight.status)) {
        throw new BadRequestError(
          `Cannot update flight with status ${existingFlight.status}. Flight has already departed or landed.`,
        );
      }

      if (existingFlight.status === 'DELAYED') {
        const allowedUpdatesForDelayed = ['status', 'departure', 'arrival'];
        const attemptedUpdates = Object.keys(req.body).filter(
          (key) => key !== 'flightPhoto',
        );
        const invalidUpdates = attemptedUpdates.filter(
          (key) => !allowedUpdatesForDelayed.includes(key),
        );

        if (invalidUpdates.length > 0) {
          throw new BadRequestError(
            `Flight is DELAYED. Only status and time updates are allowed. Cannot update: ${invalidUpdates.join(', ')}`,
          );
        }
      }

      if (status === 'CANCELLED') {
        if (hasActiveBookings) {
          logger.warn(
            `Cancelling flight ${existingFlight.flightNumber} with ${existingFlight.bookings.length} active booking(s). Bookings should be handled separately.`,
          );
          throw new BadRequestError(
            `Cannot cancel flight with ${existingFlight.bookings.length} active booking(s). Please cancel all bookings first.`,
          );
        }
      }

      const now = new Date();
      const newDeparture = departure
        ? new Date(departure)
        : existingFlight.departure;
      const newArrival = arrival ? new Date(arrival) : existingFlight.arrival;

      if (
        departure &&
        newDeparture <= now &&
        existingFlight.status === 'SCHEDULED'
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
        (parsedOriginId !== undefined || parsedDestinationId !== undefined)
      ) {
        if (
          (parsedOriginId !== undefined &&
            parsedOriginId !== existingFlight.originId) ||
          (parsedDestinationId !== undefined &&
            parsedDestinationId !== existingFlight.destinationId)
        ) {
          throw new BadRequestError(
            'Cannot change flight route (origin/destination) when bookings exist. Please cancel all bookings first or create a new flight.',
          );
        }
      }

      if (parsedCapacity !== undefined) {
        if (parsedCapacity < bookedSeats) {
          throw new BadRequestError(
            `Cannot reduce capacity to ${parsedCapacity}. ${bookedSeats} seats are already booked. Minimum capacity allowed is ${bookedSeats}.`,
          );
        }
      }

      if (parsedOriginId || parsedDestinationId) {
        const [origin, destination] = await Promise.all([
          parsedOriginId
            ? prisma.destination.findUnique({ where: { id: parsedOriginId } })
            : null,
          parsedDestinationId
            ? prisma.destination.findUnique({
                where: { id: parsedDestinationId },
              })
            : null,
        ]);

        if (
          (parsedOriginId && !origin) ||
          (parsedDestinationId && !destination)
        ) {
          throw new NotFoundError('Origin or destination not found');
        }
      }

      let calculatedDuration: number | undefined;
      if (departure !== undefined || arrival !== undefined) {
        const durationInMinutes = Math.round(
          (newArrival.getTime() - newDeparture.getTime()) / (1000 * 60),
        );
        calculatedDuration = durationInMinutes;
      }

      const updateData: any = {};

      if (flightNumber !== undefined) updateData.flightNumber = flightNumber;
      if (airline !== undefined) updateData.airline = airline;
      if (departure !== undefined) updateData.departure = newDeparture;
      if (arrival !== undefined) updateData.arrival = newArrival;
      if (calculatedDuration !== undefined)
        updateData.duration = calculatedDuration;
      if (parsedOriginId !== undefined)
        updateData.origin = { connect: { id: parsedOriginId } };
      if (parsedDestinationId !== undefined)
        updateData.destination = { connect: { id: parsedDestinationId } };
      if (parsedPrice !== undefined) updateData.price = parsedPrice;
      if (flightClass !== undefined) updateData.flightClass = flightClass;
      if (parsedStops !== undefined) updateData.stops = parsedStops;
      if (parsedCapacity !== undefined) {
        updateData.capacity = parsedCapacity;
        updateData.seatsAvailable = parsedCapacity - bookedSeats;
      }

      if (status !== undefined) {
        updateData.status = status;

        logger.info(
          `Flight ${existingFlight.flightNumber} status changed from ${existingFlight.status} to ${status}`,
        );
      }

      if (req.body.flightPhoto && typeof req.body.flightPhoto === 'string') {
        updateData.photo = req.body.flightPhoto;
        uploadedImageUrl = req.body.flightPhoto;
      }

      const updatedFlight = await prisma.flight.update({
        data: updateData,
        include: {
          destination: true,
          origin: true,
        },
        where: { id: parsedId },
      });

      if (uploadedImageUrl && oldPhoto && oldPhoto !== uploadedImageUrl) {
        try {
          await cloudinaryService.deleteImage(oldPhoto);
        } catch (cleanupError) {
          logger.warn('Failed to clean up old flight photo:', cleanupError);
        }
      }

      const response: IFlight = {
        airline: updatedFlight.airline,
        arrival: updatedFlight.arrival,
        capacity: updatedFlight.capacity,
        createdAt: updatedFlight.createdAt,
        departure: updatedFlight.departure,
        destination: updatedFlight.destination,
        duration: updatedFlight.duration,
        flightClass: updatedFlight.flightClass,
        flightNumber: updatedFlight.flightNumber,
        id: updatedFlight.id,
        origin: updatedFlight.origin,
        photo: updatedFlight.photo,
        price: updatedFlight.price,
        seatsAvailable: updatedFlight.seatsAvailable,
        status: updatedFlight.status,
        stops: updatedFlight.stops,
        updatedAt: updatedFlight.updatedAt,
      };

      res.status(HTTP_STATUS_CODES.OK).json({
        data: response,
        message: 'Flight updated successfully',
      });
    } catch (error) {
      if (uploadedImageUrl) {
        try {
          await cloudinaryService.deleteImage(uploadedImageUrl);
        } catch (cleanupError) {
          logger.error('Failed to clean up Cloudinary image:', cleanupError);
        }
      }
      next(error);
    }
  },
);

export const updateFlight: RequestHandler[] = [
  multerUpload.single('flightPhoto'),
  param('id')
    .isInt({ min: 1 })
    .withMessage('Flight ID must be an integer greater than or equal to 1'),
  ...validationMiddleware.create([
    ...updateFlightValidation,
    ...flightPhotoValidation,
  ]),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'flightPhoto'),
  handleUpdateFlight,
];

/**
 * Get all flights with advanced filtering and search
 */
const handleGetAllFlights = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const {
      airline,
      departureFrom,
      departureTo,
      destinationId,
      flightClass,
      maxDuration,
      maxPrice,
      maxStops,
      minPrice,
      minSeats,
      originId,
      search,
      sortBy = 'departure',
      sortOrder = 'asc',
    } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { flightNumber: { contains: search as string, mode: 'insensitive' } },
        { airline: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (airline) {
      where.airline = { contains: airline as string, mode: 'insensitive' };
    }

    if (originId) {
      where.originId = parseInt(originId as string);
    }

    if (destinationId) {
      where.destinationId = parseInt(destinationId as string);
    }

    if (flightClass) {
      where.flightClass = flightClass as string;
    }

    if (departureFrom || departureTo) {
      where.departure = {};
      if (departureFrom) {
        where.departure.gte = new Date(departureFrom as string);
      }
      if (departureTo) {
        where.departure.lte = new Date(departureTo as string);
      }
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        where.price.gte = parseFloat(minPrice as string);
      }
      if (maxPrice) {
        where.price.lte = parseFloat(maxPrice as string);
      }
    }

    if (maxDuration) {
      where.duration = { lte: parseInt(maxDuration as string) };
    }

    if (maxStops !== undefined) {
      where.stops = { lte: parseInt(maxStops as string) };
    }

    if (minSeats) {
      where.seatsAvailable = { gte: parseInt(minSeats as string) };
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder;

    const [flights, total] = await Promise.all([
      prisma.flight.findMany({
        include: {
          destination: {
            select: {
              city: true,
              country: true,
              id: true,
              name: true,
            },
          },
          origin: {
            select: {
              city: true,
              country: true,
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
        where,
      }),
      prisma.flight.count({ where }),
    ]);

    const response = flights.map((flight) => ({
      airline: flight.airline,
      arrival: flight.arrival,
      createdAt: flight.createdAt,
      departure: flight.departure,
      destination: flight.destination,
      destinationId: flight.destinationId,
      duration: flight.duration,
      flightClass: flight.flightClass,
      flightNumber: flight.flightNumber,
      id: flight.id,
      origin: flight.origin,
      originId: flight.originId,
      photo: flight.photo,
      price: flight.price,
      seatsAvailable: flight.seatsAvailable,
      status: flight.status,
      stops: flight.stops,
      updatedAt: flight.updatedAt,
    }));

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Flights retrieved successfully',
      meta: {
        filters: {
          airline,
          departureFrom,
          departureTo,
          destinationId: destinationId
            ? parseInt(destinationId as string)
            : undefined,
          flightClass,
          maxDuration: maxDuration
            ? parseInt(maxDuration as string)
            : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
          maxStops:
            maxStops !== undefined ? parseInt(maxStops as string) : undefined,
          minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
          minSeats: minSeats ? parseInt(minSeats as string) : undefined,
          originId: originId ? parseInt(originId as string) : undefined,
          search,
          sortBy,
          sortOrder,
        },
        limit,
        page,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);

export const getAllFlights: RequestHandler[] = [
  ...validationMiddleware.create(getFlightsValidation),
  handleGetAllFlights,
];

export const deleteFlight = asyncHandler(
  async (
    req: Request<{ id?: string }>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
      throw new UnauthorizedError('Only admins and agents can delete flights');
    }

    if (!id) {
      throw new NotFoundError('Flight ID is required');
    }

    const flightId = parseInt(id);

    if (isNaN(flightId)) {
      throw new BadRequestError('Invalid flight ID');
    }

    const flight = await prisma.flight.findUnique({
      include: {
        bookings: {
          select: {
            id: true,
            payment: {
              select: {
                amount: true,
                id: true,
                status: true,
              },
            },
            status: true,
          },
        },
      },
      where: { id: flightId },
    });

    if (!flight) {
      throw new NotFoundError('Flight not found');
    }

    const nonDeletableStatuses: FlightStatus[] = [
      'DEPARTED',
      'LANDED',
      'DELAYED',
    ];

    if (nonDeletableStatuses.includes(flight.status)) {
      throw new BadRequestError(
        `Cannot delete flight with status ${flight.status}. Only SCHEDULED or CANCELLED flights can be deleted.`,
      );
    }

    const activeBookings = flight.bookings.filter(
      (booking) =>
        booking.status === 'CONFIRMED' || booking.status === 'PENDING',
    );

    if (activeBookings.length > 0) {
      throw new BadRequestError(
        `Cannot delete flight with ${activeBookings.length} active booking(s). Please cancel all bookings first.`,
      );
    }

    const bookingsWithPayments = flight.bookings.filter(
      (booking) =>
        booking.payment &&
        (booking.payment.status === 'COMPLETED' ||
          booking.payment.status === 'PENDING'),
    );

    if (bookingsWithPayments.length > 0) {
      const totalAmount = bookingsWithPayments.reduce(
        (sum, booking) => sum + (booking.payment?.amount || 0),
        0,
      );

      throw new BadRequestError(
        `Cannot delete flight with ${bookingsWithPayments.length} booking(s) that have payment records ` +
          `(${bookingsWithPayments.filter((b) => b.payment?.status === 'COMPLETED').length} completed, ` +
          `${bookingsWithPayments.filter((b) => b.payment?.status === 'PENDING').length} pending). ` +
          `Total amount: ${totalAmount.toFixed(2)}. ` +
          `Please process refunds for all payments before deleting this flight.`,
      );
    }

    const historicalBookings = flight.bookings.filter(
      (booking) =>
        (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') &&
        (!booking.payment ||
          booking.payment.status === 'REFUNDED' ||
          booking.payment.status === 'FAILED'),
    );

    if (historicalBookings.length > 0) {
      logger.warn(
        `Deleting flight ${flight.flightNumber} (ID: ${flightId}) with ${historicalBookings.length} historical booking(s). Bookings will be orphaned.`,
      );
    }

    await prisma.flight.delete({
      where: { id: flightId },
    });

    if (flight.photo) {
      try {
        await cloudinaryService.deleteImage(flight.photo);
        logger.info(
          `Successfully deleted photo for flight ${flight.flightNumber}`,
        );
      } catch (cleanupError) {
        logger.warn(
          `Failed to clean up flight photo from Cloudinary for flight ${flight.flightNumber}:`,
          cleanupError,
        );
      }
    }

    logger.info(
      `Flight deleted successfully - ID: ${flightId}, Number: ${flight.flightNumber}, Status: ${flight.status}`,
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        deletedAt: new Date().toISOString(),
        flightNumber: flight.flightNumber,
        id: flight.id,
        status: flight.status,
      },
      message: 'Flight deleted successfully',
    });
  },
);

/**
 * Delete all flights with photo cleanup
 */
export const deleteAllFlights = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized access');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Admin privileges required');
    }

    const flightCount = await prisma.flight.count();

    if (flightCount === 0) {
      throw new BadRequestError('No flights to delete');
    }

    const flights = await prisma.flight.findMany({
      include: {
        bookings: {
          include: {
            payment: true,
          },
        },
      },
    });

    const flightsWithNonDeletableStatus: number[] = [];
    const flightsWithPendingBookings: number[] = [];
    const flightsWithConfirmedBookings: number[] = [];
    const flightsWithCompletedPayments: number[] = [];
    const flightsWithPendingPayments: number[] = [];

    const nonDeletableStatuses: FlightStatus[] = [
      'DEPARTED',
      'LANDED',
      'DELAYED',
    ];

    flights.forEach((flight) => {
      if (nonDeletableStatuses.includes(flight.status)) {
        flightsWithNonDeletableStatus.push(flight.id);
      }

      const hasPendingBookings = flight.bookings.some(
        (booking) => booking.status === 'PENDING',
      );

      if (hasPendingBookings) {
        flightsWithPendingBookings.push(flight.id);
      }

      const hasConfirmedBookings = flight.bookings.some(
        (booking) => booking.status === 'CONFIRMED',
      );

      if (hasConfirmedBookings) {
        flightsWithConfirmedBookings.push(flight.id);
      }

      const hasCompletedPayments = flight.bookings.some(
        (booking) => booking.payment && booking.payment.status === 'COMPLETED',
      );

      if (hasCompletedPayments) {
        flightsWithCompletedPayments.push(flight.id);
      }

      const hasPendingPayments = flight.bookings.some(
        (booking) => booking.payment && booking.payment.status === 'PENDING',
      );

      if (hasPendingPayments) {
        flightsWithPendingPayments.push(flight.id);
      }
    });

    // Build error message for blocking conditions
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

    await prisma.$transaction(async (tx) => {
      await tx.flight.deleteMany({});
    });

    // Clean up photos from Cloudinary after successful deletion
    const cleanupPromises = photos.map(async (photo) => {
      try {
        await cloudinaryService.deleteImage(photo);
      } catch (cleanupError) {
        logger.error(`Failed to clean up photo ${photo}:`, cleanupError);
      }
    });

    await Promise.allSettled(cleanupPromises);

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        deletedCount: flights.length,
      },
      message: `Successfully deleted ${flights.length} flight${flights.length > 1 ? 's' : ''}`,
    });
  },
);

/**
 * Get flight statistics (for admin dashboard)
 */
export const getFlightStats = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
      throw new UnauthorizedError(
        'Only admins and agents can view flight statistics',
      );
    }

    const now = new Date();

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

      prisma.flight.aggregate({
        _sum: {
          seatsAvailable: true,
        },
      }),

      prisma.flight.aggregate({
        _sum: {
          capacity: true,
        },
      }),

      prisma.flight.aggregate({
        _avg: {
          price: true,
        },
      }),

      prisma.flight.groupBy({
        _count: true,
        by: ['flightClass'],
        orderBy: {
          _count: {
            flightClass: 'desc',
          },
        },
      }),

      prisma.flight.groupBy({
        _count: true,
        by: ['airline'],
        orderBy: {
          _count: {
            airline: 'desc',
          },
        },
        take: 10,
      }),

      prisma.flight.groupBy({
        _count: true,
        _sum: {
          capacity: true,
          seatsAvailable: true,
        },
        by: ['status'],
      }),

      prisma.flight.count({
        where: { status: 'SCHEDULED' },
      }),

      prisma.flight.count({
        where: { status: 'DEPARTED' },
      }),

      prisma.flight.count({
        where: { status: 'LANDED' },
      }),

      prisma.flight.count({
        where: { status: 'DELAYED' },
      }),

      prisma.flight.count({
        where: { status: 'CANCELLED' },
      }),

      prisma.flight.count({
        where: {
          departure: {
            gte: now,
          },
          status: 'SCHEDULED',
        },
      }),

      prisma.booking.aggregate({
        _sum: {
          totalPrice: true,
        },
        where: {
          flightId: { not: null },
          payment: {
            status: 'COMPLETED',
          },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
      }),

      prisma.flight.count({
        where: {
          bookings: {
            some: {
              status: { in: ['PENDING', 'CONFIRMED'] },
            },
          },
        },
      }),
    ]);

    const totalCapacity = totalBookedSeats._sum.capacity || 0;
    const totalAvailable = totalSeats._sum.seatsAvailable || 0;
    const totalBooked = totalCapacity - totalAvailable;
    const occupancyRate =
      totalCapacity > 0
        ? ((totalBooked / totalCapacity) * 100).toFixed(2)
        : '0.00';

    const statusBreakdown = flightsByStatus.map((item) => {
      const capacity = item._sum.capacity || 0;
      const available = item._sum.seatsAvailable || 0;
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

    const stats = {
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
            ? Math.round(
                ((totalRevenue._sum.totalPrice || 0) / flightsWithBookings) *
                  100,
              ) / 100
            : 0,
        revenuePerSeat:
          totalBooked > 0
            ? Math.round(
                ((totalRevenue._sum.totalPrice || 0) / totalBooked) * 100,
              ) / 100
            : 0,
        totalRevenue:
          Math.round((totalRevenue._sum.totalPrice || 0) * 100) / 100,
      },

      operationalMetrics: {
        cancellationRate:
          totalFlights > 0
            ? ((cancelledFlights / totalFlights) * 100).toFixed(2) + '%'
            : '0.00%',
        cancelledFlights,
        completedFlights: landedFlights,
        completionRate:
          totalFlights > 0
            ? ((landedFlights / totalFlights) * 100).toFixed(2) + '%'
            : '0.00%',
        delayedFlights,
        delayRate:
          totalFlights > 0
            ? ((delayedFlights / totalFlights) * 100).toFixed(2) + '%'
            : '0.00%',
        onTimeFlights: scheduledFlights + departedFlights,
      },

      overview: {
        averagePrice: Math.round((averagePrice._avg.price || 0) * 100) / 100,
        flightsWithBookings,
        occupancyRate: `${occupancyRate}%`,
        totalCapacity,
        totalFlights,
        totalRevenue:
          Math.round((totalRevenue._sum.totalPrice || 0) * 100) / 100,
        totalSeatsAvailable: totalAvailable,
        totalSeatsBooked: totalBooked,
      },

      topAirlines: flightsByAirline.map((item) => ({
        airline: item.airline,
        count: item._count,
      })),
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      data: stats,
      message: 'Flight statistics retrieved successfully',
    });
  },
);

/**
 * Update flight status with optional time adjustments for delayed flights
 */
const handleUpdateFlightStatus = asyncHandler(
  async (
    req: Request<
      { id?: string },
      {},
      { arrival?: string; departure?: string; status: FlightStatus }
    >,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const { arrival, departure, status } = req.body;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
      throw new UnauthorizedError(
        'Only admins and agents can update flight status',
      );
    }

    const parsedId = parseInt(id!, 10);

    if (isNaN(parsedId)) {
      throw new BadRequestError('Invalid flight ID');
    }

    const existingFlight = await prisma.flight.findUnique({
      include: {
        bookings: {
          include: {
            payment: true,
          },
        },
      },
      where: { id: parsedId },
    });

    if (!existingFlight) {
      throw new NotFoundError('Flight not found');
    }

    const currentStatus = existingFlight.status;
    const newStatus = status;

    if (newStatus === currentStatus) {
      throw new BadRequestError('New status is the same as current status');
    }

    const now = new Date();
    const originalDeparture = new Date(existingFlight.departure);
    const originalArrival = new Date(existingFlight.arrival);

    let isValidTransition = false;
    let setDepartureToNow = false;
    let setArrivalToNow = false;

    if (currentStatus === 'SCHEDULED') {
      if (newStatus === 'DEPARTED') {
        if (originalDeparture > now) {
          throw new BadRequestError(
            `Cannot mark flight as DEPARTED. The scheduled departure time is ${originalDeparture} which is still in the future.`,
          );
        }
        isValidTransition = true;
        setDepartureToNow = true;
      } else if (newStatus === 'DELAYED') {
        isValidTransition = true;
      } else if (newStatus === 'CANCELLED') {
        isValidTransition = true;
      }
    } else if (currentStatus === 'DELAYED') {
      if (newStatus === 'DEPARTED') {
        if (originalDeparture > now) {
          throw new BadRequestError(
            `Cannot mark flight as DEPARTED. The delayed departure time is ${originalDeparture} which is still in the future.`,
          );
        }
        isValidTransition = true;
        setDepartureToNow = true;
      } else if (newStatus === 'CANCELLED') {
        isValidTransition = true;
      } else if (newStatus === 'SCHEDULED') {
        isValidTransition = true;
      }
    } else if (currentStatus === 'DEPARTED') {
      if (newStatus === 'LANDED') {
        if (originalArrival > now) {
          throw new BadRequestError(
            `Cannot mark flight as LANDED. The scheduled arrival time is ${originalArrival} which is still in the future.`,
          );
        }
        isValidTransition = true;
        setArrivalToNow = true;
      }
    } else if (currentStatus === 'CANCELLED') {
      if (newStatus === 'SCHEDULED') {
        if (originalDeparture < now) {
          throw new BadRequestError(
            `Cannot reschedule cancelled flight. The original departure time of ${originalDeparture} has already passed. Please create a new flight instead.`,
          );
        }
        isValidTransition = true;
      }
    } else if (currentStatus === 'LANDED') {
      throw new BadRequestError(
        'Cannot change status of a flight that has already landed.',
      );
    }

    if (!isValidTransition) {
      throw new BadRequestError(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Please follow proper flight status workflow.`,
      );
    }

    if (newStatus === 'CANCELLED') {
      const hasCompletedPayments = existingFlight.bookings.some(
        (b) => b.payment?.status === 'COMPLETED',
      );

      if (hasCompletedPayments) {
        throw new BadRequestError(
          'Cannot cancel flight with completed payments. Please process refunds first.',
        );
      }

      const hasConfirmedBookings = existingFlight.bookings.some(
        (b) => b.status === 'CONFIRMED',
      );

      if (hasConfirmedBookings) {
        throw new BadRequestError(
          'Cannot cancel flight with confirmed bookings. Please cancel all confirmed bookings first.',
        );
      }

      const hasAnyBookings = existingFlight.bookings.length > 0;

      if (hasAnyBookings) {
        throw new BadRequestError(
          'Cannot cancel flight with existing bookings. Please cancel all bookings first.',
        );
      }
    }

    if (newStatus !== 'DELAYED' && (departure || arrival)) {
      throw new BadRequestError(
        'Time updates are only allowed when setting status to DELAYED.',
      );
    }

    let newDeparture = existingFlight.departure;
    let newArrival = existingFlight.arrival;
    let calculatedDuration = existingFlight.duration;

    if (newStatus === 'DELAYED') {
      if (!departure || !arrival) {
        throw new BadRequestError(
          'For DELAYED status, both updated departure and arrival times are required.',
        );
      }

      newDeparture = new Date(departure);
      newArrival = new Date(arrival);

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

      calculatedDuration = Math.round(
        (newArrival.getTime() - newDeparture.getTime()) / (1000 * 60),
      );

      if (calculatedDuration < 10) {
        throw new BadRequestError(
          'Flight duration cannot be less than 10 minutes.',
        );
      }

      if (calculatedDuration > 1440) {
        throw new BadRequestError('Flight duration cannot exceed 24 hours.');
      }
    } else {
      if (setDepartureToNow) {
        newDeparture = now;
      }
      if (setArrivalToNow) {
        newArrival = now;
      }

      if (setDepartureToNow || setArrivalToNow) {
        if (newArrival <= newDeparture) {
          throw new BadRequestError(
            'Arrival time must be after departure time.',
          );
        }

        calculatedDuration = Math.round(
          (newArrival.getTime() - newDeparture.getTime()) / (1000 * 60),
        );
      }
    }

    const updateData: any = {
      status: newStatus,
    };

    if (newDeparture.getTime() !== existingFlight.departure.getTime()) {
      updateData.departure = newDeparture;
    }
    if (newArrival.getTime() !== existingFlight.arrival.getTime()) {
      updateData.arrival = newArrival;
    }
    if (calculatedDuration !== existingFlight.duration) {
      updateData.duration = calculatedDuration;
    }

    const updatedFlight = await prisma.flight.update({
      data: updateData,
      include: {
        destination: true,
        origin: true,
      },
      where: { id: parsedId },
    });

    logger.info(
      `Flight ${existingFlight.flightNumber} status changed from ${currentStatus} to ${newStatus} by ${user.role} user ${user.id}`,
    );

    if (newStatus === 'CANCELLED') {
      await prisma.booking.updateMany({
        data: {
          status: 'CANCELLED',
        },
        where: {
          flightId: parsedId,
          status: {
            in: ['PENDING', 'CONFIRMED'],
          },
        },
      });

      logger.info(
        `Auto-cancelled all active bookings for flight ${existingFlight.flightNumber}`,
      );
    }

    const response: IFlight = {
      airline: updatedFlight.airline,
      arrival: updatedFlight.arrival,
      capacity: updatedFlight.capacity,
      createdAt: updatedFlight.createdAt,
      departure: updatedFlight.departure,
      destination: updatedFlight.destination,
      duration: updatedFlight.duration,
      flightClass: updatedFlight.flightClass,
      flightNumber: updatedFlight.flightNumber,
      id: updatedFlight.id,
      origin: updatedFlight.origin,
      photo: updatedFlight.photo,
      price: updatedFlight.price,
      seatsAvailable: updatedFlight.seatsAvailable,
      status: updatedFlight.status,
      stops: updatedFlight.stops,
      updatedAt: updatedFlight.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Flight status updated successfully',
    });
  },
);

export const updateFlightStatus: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Flight ID must be a positive integer'),
  ...validationMiddleware.create(updateFlightStatusValidation),
  handleUpdateFlightStatus,
];
