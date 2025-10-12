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
import { IFlightInput, IFlightResponse } from 'types/flight.types';
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
    const user = req.user;

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

    const response: IFlightResponse = {
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
    req: Request<{ id?: string }, {}, Partial<IFlightInput>>,
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

    let uploadedImageUrl: string | undefined;
    let oldPhoto: string | null = null;

    try {
      const existingFlight = await prisma.flight.findUnique({
        where: { id: parsedId },
        include: { bookings: { select: { id: true } } },
      });

      if (!existingFlight) {
        throw new NotFoundError('Flight not found');
      }

      oldPhoto = existingFlight.photo;
      const now = new Date();
      const bookedSeats =
        existingFlight.capacity - existingFlight.seatsAvailable;
      const hasBookings = existingFlight.bookings.length > 0;

      if (existingFlight.departure <= now) {
        throw new BadRequestError(
          'Cannot update flight that has already departed',
        );
      }

      if (existingFlight.arrival <= now) {
        throw new BadRequestError(
          'Cannot update flight that has already arrived',
        );
      }

      const newDeparture = departure
        ? new Date(departure)
        : existingFlight.departure;
      const newArrival = arrival ? new Date(arrival) : existingFlight.arrival;

      if (departure && newDeparture <= now) {
        throw new BadRequestError('Departure time must be in the future');
      }

      if (arrival && newArrival <= now) {
        throw new BadRequestError('Arrival time must be in the future');
      }

      if (newArrival <= newDeparture) {
        throw new BadRequestError('Arrival time must be after departure time');
      }

      if (
        hasBookings &&
        (parsedOriginId !== undefined || parsedDestinationId !== undefined)
      ) {
        if (
          parsedOriginId !== existingFlight.originId ||
          parsedDestinationId !== existingFlight.destinationId
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
          console.warn('Failed to clean up old flight photo:', cleanupError);
        }
      }

      const response: IFlightResponse = {
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
          console.error('Failed to clean up Cloudinary image:', cleanupError);
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
 * Delete a flight with photo cleanup
 */
const handleDeleteFlight = asyncHandler(
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

    const flight = await prisma.flight.findUnique({
      where: { id: flightId },
      include: { bookings: true },
    });

    if (!flight) {
      throw new NotFoundError('Flight not found');
    }

    // Check if flight has bookings
    if (flight.bookings.length > 0) {
      throw new BadRequestError(
        `This flight cannot be deleted because it has ${flight.bookings.length} associated booking(s). Please cancel or reassign those bookings first.`,
      );
    }

    // Delete from database
    await prisma.flight.delete({
      where: { id: flightId },
    });

    // Clean up photo from Cloudinary if it exists
    if (flight.photo) {
      try {
        await cloudinaryService.deleteImage(flight.photo);
      } catch (cleanupError) {
        console.warn(
          'Failed to clean up flight photo from Cloudinary:',
          cleanupError,
        );
      }
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Flight deleted successfully',
    });
  },
);

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

/**
 * Delete all flights with photo cleanup
 */
const handleDeleteAllFlights = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Only admins can delete all flights');
    }

    // First check if there are any flights at all
    const flightCount = await prisma.flight.count();

    if (flightCount === 0) {
      throw new BadRequestError('No flights found to delete.');
    }

    // Fetch all flights with their bookings
    const flights = await prisma.flight.findMany({
      include: {
        bookings: {
          include: {
            payment: true,
          },
        },
      },
    });

    // Categorize flights by deletion eligibility
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

    flights.forEach((flight) => {
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
          `Please cancel active bookings, process refunds, and resolve payment records first.`,
      );
    }

    const totalSkipped =
      flightsWithActiveBookings.length +
      flightsWithPaidBookings.length +
      flightsWithCompletedBookings.length;

    if (totalSkipped > 0) {
      console.warn(
        `Skipping ${totalSkipped} flight(s): ` +
          `${flightsWithActiveBookings.length} with active bookings, ` +
          `${flightsWithPaidBookings.length} with payment records, ` +
          `${flightsWithCompletedBookings.length} with completed bookings.`,
      );
    }

    // Collect photos for cleanup
    const photos = deletableFlights
      .map((flight) => flight.photo)
      .filter((photo): photo is string => Boolean(photo));

    // Delete flights in a transaction for data consistency
    await prisma.$transaction(async (tx) => {
      await tx.flight.deleteMany({
        where: {
          id: { in: deletableFlights.map((f) => f.id) },
        },
      });
    });

    // Clean up photos from cloud storage
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
        withActiveBookings: flightsWithActiveBookings.length,
        withPaidBookings: flightsWithPaidBookings.length,
        withCompletedBookings: flightsWithCompletedBookings.length,
      },
      deletedFlightIds: deletableFlights.map((f) => f.id),
      deletedFlightNumbers: deletableFlights.map((f) => f.flightNumber),
    });
  },
);

/**
 * Get flight statistics (for admin dashboard)
 */
const getFlightStats = asyncHandler(
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

    const [
      totalFlights,
      totalSeats,
      averagePrice,
      flightsByClass,
      flightsByAirline,
      upcomingFlights,
    ] = await Promise.all([
      prisma.flight.count(),
      prisma.flight.aggregate({
        _sum: {
          seatsAvailable: true,
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
      prisma.flight.count({
        where: {
          departure: {
            gte: new Date(),
          },
        },
      }),
    ]);

    const stats = {
      totalFlights,
      totalSeats: totalSeats._sum.seatsAvailable || 0,
      averagePrice: Math.round((averagePrice._avg.price || 0) * 100) / 100,
      upcomingFlights,
      flightsByClass: flightsByClass.map((item) => ({
        class: item.flightClass,
        count: item._count,
      })),
      topAirlines: flightsByAirline.map((item) => ({
        airline: item.airline,
        count: item._count,
      })),
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Flight statistics retrieved successfully',
      data: stats,
    });
  },
);

export const deleteFlight: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Flight ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleDeleteFlight,
];

export const getAllFlights: RequestHandler[] = [
  ...validationMiddleware.create(getFlightsValidation),
  handleGetAllFlights,
];

export const deleteAllFlights: RequestHandler[] = [handleDeleteAllFlights];

export const getFlightStatistics: RequestHandler[] = [getFlightStats];
