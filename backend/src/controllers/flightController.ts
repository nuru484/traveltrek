// src/controllers/flight/flight-controller.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { param } from 'express-validator';
import prisma from '../config/prismaClient';
import validationMiddleware from '../middlewares/validation';
import {
  asyncHandler,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
} from '../middlewares/error-handler';
import { HTTP_STATUS_CODES } from '../config/constants';
import { IFlightInput, IFlight, IFlightUpdateInput } from 'types/flight.types';
import multerUpload from '../config/multer';
import conditionalCloudinaryUpload from '../middlewares/conditional-cloudinary-upload';
import { CLOUDINARY_UPLOAD_OPTIONS } from '../config/constants';
import { cloudinaryService } from '../config/claudinary';
import {
  createFlightValidation,
  updateFlightValidation,
  getFlightsValidation,
  flightPhotoValidation,
} from '../validations/flight-validation';
import logger from '../utils/logger';
import { FlightStatus } from '../../generated/prisma';

/**
 * Create a new flight
 */
const handleCreateFlight = asyncHandler(
  async (
    req: Request<{}, {}, IFlightInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const {
      flightNumber,
      airline,
      departure,
      arrival,
      originId,
      destinationId,
      price,
      flightClass,
      stops,
      capacity,
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
        flightNumber,
        airline,
        departure: departureDate,
        arrival: arrivalDate,
        origin: { connect: { id: parsedOriginId } },
        destination: { connect: { id: parsedDestinationId } },
        price: parsedPrice,
        flightClass,
        duration: durationInMinutes,
        stops: parsedStops,
        photo: typeof photoUrl === 'string' ? photoUrl : null,
        seatsAvailable: parsedCapacity,
        capacity: parsedCapacity,
      },
      include: {
        destination: true,
        origin: true,
      },
    });

    const response: IFlight = {
      id: flight.id,
      flightNumber: flight.flightNumber,
      airline: flight.airline,
      departure: flight.departure,
      arrival: flight.arrival,
      origin: flight.origin,
      destination: flight.destination,
      price: flight.price,
      flightClass: flight.flightClass,
      duration: flight.duration,
      stops: flight.stops,
      status: flight.status,
      photo: flight.photo,
      seatsAvailable: flight.seatsAvailable,
      capacity: flight.capacity,
      createdAt: flight.createdAt,
      updatedAt: flight.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.CREATED).json({
      message: 'Flight created successfully',
      data: response,
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
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const flight = await prisma.flight.findUnique({
      where: { id: parseInt(id) },
      include: {
        origin: {
          select: {
            id: true,
            name: true,
            country: true,
            city: true,
          },
        },
        destination: {
          select: {
            id: true,
            name: true,
            country: true,
            city: true,
          },
        },
      },
    });

    if (!flight) {
      throw new NotFoundError('Flight not found');
    }

    const response = {
      id: flight.id,
      flightNumber: flight.flightNumber,
      airline: flight.airline,
      departure: flight.departure,
      arrival: flight.arrival,
      originId: flight.originId,
      destinationId: flight.destinationId,
      origin: flight.origin,
      destination: flight.destination,
      price: flight.price,
      flightClass: flight.flightClass,
      duration: flight.duration,
      status: flight.status,
      stops: flight.stops,
      photo: flight.photo,
      seatsAvailable: flight.seatsAvailable,
      capacity: flight.capacity,
      createdAt: flight.createdAt,
      updatedAt: flight.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Flight retrieved successfully',
      data: response,
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
      flightNumber,
      airline,
      departure,
      arrival,
      originId,
      destinationId,
      price,
      flightClass,
      stops,
      capacity,
      status,
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
    let oldPhoto: string | null = null;

    try {
      const existingFlight = await prisma.flight.findUnique({
        where: { id: parsedId },
        include: { bookings: { select: { id: true, status: true } } },
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
        where: { id: parsedId },
        data: updateData,
        include: {
          origin: true,
          destination: true,
        },
      });

      if (uploadedImageUrl && oldPhoto && oldPhoto !== uploadedImageUrl) {
        try {
          await cloudinaryService.deleteImage(oldPhoto);
        } catch (cleanupError) {
          logger.warn('Failed to clean up old flight photo:', cleanupError);
        }
      }

      const response: IFlight = {
        id: updatedFlight.id,
        flightNumber: updatedFlight.flightNumber,
        airline: updatedFlight.airline,
        departure: updatedFlight.departure,
        arrival: updatedFlight.arrival,
        origin: updatedFlight.origin,
        destination: updatedFlight.destination,
        price: updatedFlight.price,
        flightClass: updatedFlight.flightClass,
        duration: updatedFlight.duration,
        status: updatedFlight.status,
        stops: updatedFlight.stops,
        photo: updatedFlight.photo,
        seatsAvailable: updatedFlight.seatsAvailable,
        capacity: updatedFlight.capacity,
        createdAt: updatedFlight.createdAt,
        updatedAt: updatedFlight.updatedAt,
      };

      res.status(HTTP_STATUS_CODES.OK).json({
        message: 'Flight updated successfully',
        data: response,
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
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const {
      search,
      airline,
      originId,
      destinationId,
      flightClass,
      departureFrom,
      departureTo,
      minPrice,
      maxPrice,
      maxDuration,
      maxStops,
      minSeats,
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
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          origin: {
            select: {
              id: true,
              name: true,
              country: true,
              city: true,
            },
          },
          destination: {
            select: {
              id: true,
              name: true,
              country: true,
              city: true,
            },
          },
        },
      }),
      prisma.flight.count({ where }),
    ]);

    const response = flights.map((flight) => ({
      id: flight.id,
      flightNumber: flight.flightNumber,
      airline: flight.airline,
      departure: flight.departure,
      arrival: flight.arrival,
      originId: flight.originId,
      destinationId: flight.destinationId,
      origin: flight.origin,
      destination: flight.destination,
      price: flight.price,
      status: flight.status,
      flightClass: flight.flightClass,
      duration: flight.duration,
      stops: flight.stops,
      photo: flight.photo,
      seatsAvailable: flight.seatsAvailable,
      createdAt: flight.createdAt,
      updatedAt: flight.updatedAt,
    }));

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Flights retrieved successfully',
      data: response,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        filters: {
          search,
          airline,
          originId: originId ? parseInt(originId as string) : undefined,
          destinationId: destinationId
            ? parseInt(destinationId as string)
            : undefined,
          flightClass,
          departureFrom,
          departureTo,
          minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
          maxDuration: maxDuration
            ? parseInt(maxDuration as string)
            : undefined,
          maxStops:
            maxStops !== undefined ? parseInt(maxStops as string) : undefined,
          minSeats: minSeats ? parseInt(minSeats as string) : undefined,
          sortBy,
          sortOrder,
        },
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
    next: NextFunction,
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
      where: { id: flightId },
      include: {
        bookings: {
          select: {
            id: true,
            status: true,
            payment: {
              select: {
                id: true,
                status: true,
                amount: true,
              },
            },
          },
        },
      },
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
      message: 'Flight deleted successfully',
      data: {
        id: flight.id,
        flightNumber: flight.flightNumber,
        status: flight.status,
        deletedAt: new Date().toISOString(),
      },
    });
  },
);

/**
 * Delete all flights with photo cleanup
 */
export const deleteAllFlights = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Only admins can delete all flights');
    }

    const flightCount = await prisma.flight.count();

    if (flightCount === 0) {
      throw new BadRequestError('No flights found to delete.');
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

    const flightsWithNonDeletableStatus: Array<{
      id: number;
      flightNumber: string;
      status: FlightStatus;
    }> = [];

    const flightsWithActiveBookings: Array<{
      id: number;
      flightNumber: string;
      bookingCount: number;
      pendingCount: number;
      confirmedCount: number;
    }> = [];

    const flightsWithCompletedBookings: Array<{
      id: number;
      flightNumber: string;
      bookingCount: number;
    }> = [];

    const flightsWithPaidBookings: Array<{
      id: number;
      flightNumber: string;
      paidBookingCount: number;
    }> = [];

    const deletableFlights: typeof flights = [];

    const now = new Date();
    const nonDeletableStatuses: FlightStatus[] = [
      'DEPARTED',
      'LANDED',
      'DELAYED',
    ];

    flights.forEach((flight) => {
      if (nonDeletableStatuses.includes(flight.status)) {
        flightsWithNonDeletableStatus.push({
          id: flight.id,
          flightNumber: flight.flightNumber,
          status: flight.status,
        });
        return;
      }

      if (flight.bookings.length === 0) {
        deletableFlights.push(flight);
        return;
      }

      const activeBookings = flight.bookings.filter((booking) =>
        ['PENDING', 'CONFIRMED'].includes(booking.status),
      );

      const completedBookings = flight.bookings.filter(
        (booking) => booking.status === 'COMPLETED',
      );

      const paidBookings = flight.bookings.filter(
        (booking) =>
          booking.payment &&
          ['COMPLETED', 'PENDING'].includes(booking.payment.status),
      );

      const isUpcomingFlight = flight.departure > now;

      if (activeBookings.length > 0) {
        const pendingCount = activeBookings.filter(
          (b) => b.status === 'PENDING',
        ).length;
        const confirmedCount = activeBookings.filter(
          (b) => b.status === 'CONFIRMED',
        ).length;

        flightsWithActiveBookings.push({
          id: flight.id,
          flightNumber: flight.flightNumber,
          bookingCount: activeBookings.length,
          pendingCount,
          confirmedCount,
        });
      } else if (paidBookings.length > 0) {
        flightsWithPaidBookings.push({
          id: flight.id,
          flightNumber: flight.flightNumber,
          paidBookingCount: paidBookings.length,
        });
      } else if (completedBookings.length > 0 && isUpcomingFlight) {
        flightsWithCompletedBookings.push({
          id: flight.id,
          flightNumber: flight.flightNumber,
          bookingCount: completedBookings.length,
        });
      } else {
        deletableFlights.push(flight);
      }
    });

    if (deletableFlights.length === 0) {
      const errorMessages: string[] = [];

      if (flightsWithNonDeletableStatus.length > 0) {
        const statusBreakdown = flightsWithNonDeletableStatus.reduce(
          (acc, f) => {
            acc[f.status] = (acc[f.status] || 0) + 1;
            return acc;
          },
          {} as Record<FlightStatus, number>,
        );

        const statusSummary = Object.entries(statusBreakdown)
          .map(([status, count]) => `${count} ${status}`)
          .join(', ');

        errorMessages.push(
          `${flightsWithNonDeletableStatus.length} flight(s) have non-deletable status (${statusSummary}).`,
        );
      }

      if (flightsWithActiveBookings.length > 0) {
        const totalActive = flightsWithActiveBookings.reduce(
          (sum, f) => sum + f.bookingCount,
          0,
        );
        const totalPending = flightsWithActiveBookings.reduce(
          (sum, f) => sum + f.pendingCount,
          0,
        );
        const totalConfirmed = flightsWithActiveBookings.reduce(
          (sum, f) => sum + f.confirmedCount,
          0,
        );

        errorMessages.push(
          `${flightsWithActiveBookings.length} flight(s) have ${totalActive} active booking(s) ` +
            `(${totalPending} pending, ${totalConfirmed} confirmed).`,
        );
      }

      if (flightsWithPaidBookings.length > 0) {
        const totalPaid = flightsWithPaidBookings.reduce(
          (sum, f) => sum + f.paidBookingCount,
          0,
        );
        errorMessages.push(
          `${flightsWithPaidBookings.length} flight(s) have ${totalPaid} booking(s) with payment records.`,
        );
      }

      if (flightsWithCompletedBookings.length > 0) {
        errorMessages.push(
          `${flightsWithCompletedBookings.length} upcoming flight(s) have completed bookings (data integrity concern).`,
        );
      }

      throw new BadRequestError(
        `Cannot delete any flights. ${errorMessages.join(' ')} ` +
          `Only SCHEDULED or CANCELLED flights without active bookings or payment records can be deleted.`,
      );
    }

    const totalSkipped =
      flightsWithNonDeletableStatus.length +
      flightsWithActiveBookings.length +
      flightsWithPaidBookings.length +
      flightsWithCompletedBookings.length;

    if (totalSkipped > 0) {
      logger.warn(
        `Skipping ${totalSkipped} flight(s): ` +
          `${flightsWithNonDeletableStatus.length} with non-deletable status, ` +
          `${flightsWithActiveBookings.length} with active bookings, ` +
          `${flightsWithPaidBookings.length} with payment records, ` +
          `${flightsWithCompletedBookings.length} with completed bookings.`,
      );
    }

    const photos = deletableFlights
      .map((flight) => flight.photo)
      .filter((photo): photo is string => Boolean(photo));

    await prisma.$transaction(async (tx) => {
      await tx.flight.deleteMany({
        where: {
          id: { in: deletableFlights.map((f) => f.id) },
        },
      });
    });

    const cleanupPromises = photos.map(async (photo) => {
      try {
        await cloudinaryService.deleteImage(photo);
      } catch (cleanupError) {
        logger.error(`Failed to clean up photo ${photo}:`, cleanupError);
      }
    });

    await Promise.allSettled(cleanupPromises);

    const responseMessage = [
      `Successfully deleted ${deletableFlights.length} flight(s).`,
    ];

    if (flightsWithNonDeletableStatus.length > 0) {
      const statusBreakdown = flightsWithNonDeletableStatus.reduce(
        (acc, f) => {
          acc[f.status] = (acc[f.status] || 0) + 1;
          return acc;
        },
        {} as Record<FlightStatus, number>,
      );

      const statusSummary = Object.entries(statusBreakdown)
        .map(([status, count]) => `${count} ${status}`)
        .join(', ');

      responseMessage.push(
        `Skipped ${flightsWithNonDeletableStatus.length} flight(s) with non-deletable status (${statusSummary}).`,
      );
    }

    if (flightsWithActiveBookings.length > 0) {
      responseMessage.push(
        `Skipped ${flightsWithActiveBookings.length} flight(s) with active bookings.`,
      );
    }

    if (flightsWithPaidBookings.length > 0) {
      responseMessage.push(
        `Skipped ${flightsWithPaidBookings.length} flight(s) with payment records.`,
      );
    }

    if (flightsWithCompletedBookings.length > 0) {
      responseMessage.push(
        `Skipped ${flightsWithCompletedBookings.length} flight(s) with historical booking data.`,
      );
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: responseMessage.join(' '),
      deleted: deletableFlights.length,
      skipped: {
        total: totalSkipped,
        withNonDeletableStatus: flightsWithNonDeletableStatus.length,
        withActiveBookings: flightsWithActiveBookings.length,
        withPaidBookings: flightsWithPaidBookings.length,
        withCompletedBookings: flightsWithCompletedBookings.length,
      },
      deletedFlightIds: deletableFlights.map((f) => f.id),
      deletedFlightNumbers: deletableFlights.map((f) => f.flightNumber),
      statusBreakdown: flightsWithNonDeletableStatus.reduce(
        (acc, f) => {
          acc[f.status] = (acc[f.status] || 0) + 1;
          return acc;
        },
        {} as Record<FlightStatus, number>,
      ),
    });
  },
);

/**
 * Get flight statistics (for admin dashboard)
 */
export const getFlightStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        by: ['flightClass'],
        _count: true,
        orderBy: {
          _count: {
            flightClass: 'desc',
          },
        },
      }),

      prisma.flight.groupBy({
        by: ['airline'],
        _count: true,
        orderBy: {
          _count: {
            airline: 'desc',
          },
        },
        take: 10,
      }),

      prisma.flight.groupBy({
        by: ['status'],
        _count: true,
        _sum: {
          seatsAvailable: true,
          capacity: true,
        },
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
          status: 'SCHEDULED',
          departure: {
            gte: now,
          },
        },
      }),

      prisma.booking.aggregate({
        where: {
          flightId: { not: null },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          payment: {
            status: 'COMPLETED',
          },
        },
        _sum: {
          totalPrice: true,
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
      totalCapacity > 0 ? ((totalBooked / totalCapacity) * 100).toFixed(2) : '0.00';

    const statusBreakdown = flightsByStatus.map((item) => {
      const capacity = item._sum.capacity || 0;
      const available = item._sum.seatsAvailable || 0;
      const booked = capacity - available;
      const rate = capacity > 0 ? ((booked / capacity) * 100).toFixed(2) : '0.00';

      return {
        status: item.status,
        count: item._count,
        totalCapacity: capacity,
        seatsBooked: booked,
        seatsAvailable: available,
        occupancyRate: `${rate}%`,
      };
    });

    const stats = {
      overview: {
        totalFlights,
        totalCapacity,
        totalSeatsBooked: totalBooked,
        totalSeatsAvailable: totalAvailable,
        occupancyRate: `${occupancyRate}%`,
        averagePrice: Math.round((averagePrice._avg.price || 0) * 100) / 100,
        totalRevenue: Math.round((totalRevenue._sum.totalPrice || 0) * 100) / 100,
        flightsWithBookings,
      },

      byStatus: {
        scheduled: scheduledFlights,
        departed: departedFlights,
        landed: landedFlights,
        delayed: delayedFlights,
        cancelled: cancelledFlights,
        upcoming: upcomingFlights, 
        detailed: statusBreakdown,
      },

      byClass: flightsByClass.map((item) => ({
        class: item.flightClass,
        count: item._count,
      })),

      topAirlines: flightsByAirline.map((item) => ({
        airline: item.airline,
        count: item._count,
      })),

      operationalMetrics: {
        onTimeFlights: scheduledFlights + departedFlights,
        delayedFlights,
        cancelledFlights,
        completedFlights: landedFlights,
        delayRate:
          totalFlights > 0
            ? ((delayedFlights / totalFlights) * 100).toFixed(2) + '%'
            : '0.00%',
        cancellationRate:
          totalFlights > 0
            ? ((cancelledFlights / totalFlights) * 100).toFixed(2) + '%'
            : '0.00%',
        completionRate:
          totalFlights > 0
            ? ((landedFlights / totalFlights) * 100).toFixed(2) + '%'
            : '0.00%',
      },

      financialMetrics: {
        totalRevenue: Math.round((totalRevenue._sum.totalPrice || 0) * 100) / 100,
        averageBookingValue:
          flightsWithBookings > 0
            ? Math.round(
                ((totalRevenue._sum.totalPrice || 0) / flightsWithBookings) * 100,
              ) / 100
            : 0,
        revenuePerSeat:
          totalBooked > 0
            ? Math.round(((totalRevenue._sum.totalPrice || 0) / totalBooked) * 100) / 100
            : 0,
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Flight statistics retrieved successfully',
      data: stats,
    });
  },
);