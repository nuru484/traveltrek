import { NextFunction, Request, RequestHandler, Response } from 'express';
import { param } from 'express-validator';
import { body } from 'express-validator';
import { ITourInput, ITourResponse } from 'types/tour.types';

import { TourStatus } from '../../generated/prisma/client';
import { HTTP_STATUS_CODES } from '../config/constants';
import prisma from '../config/prismaClient';
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
  createTourValidation,
  getAllToursValidation,
  updateTourValidation,
} from '../validations/tour-validation';

const handleCreateTour = asyncHandler(
  async (
    req: Request<{}, {}, ITourInput>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const {
      description,
      destinationId,
      endDate,
      maxGuests,
      name,
      price,
      startDate,
      type,
    } = req.body;

    const destination = await prisma.destination.findUnique({
      where: { id: destinationId },
    });

    if (!destination) {
      throw new NotFoundError('Destination not found');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationInDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    const tour = await prisma.tour.create({
      data: {
        description,
        destinationId,
        duration: durationInDays,
        endDate: end,
        maxGuests,
        name,
        price,
        startDate: start,
        type,
      },
      include: {
        destination: {
          select: {
            city: true,
            country: true,
            id: true,
            name: true,
          },
        },
      },
    });

    const response: ITourResponse = {
      createdAt: tour.createdAt,
      description: tour.description,
      destination: tour.destination,
      duration: tour.duration,
      endDate: tour.endDate,
      guestsBooked: tour.guestsBooked,
      id: tour.id,
      maxGuests: tour.maxGuests,
      name: tour.name,
      price: tour.price,
      startDate: tour.startDate,
      status: tour.status,
      type: tour.type,
      updatedAt: tour.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.CREATED).json({
      data: response,
      message: 'Tour created successfully',
    });
  },
);

export const createTour: RequestHandler[] = [
  ...validationMiddleware.create(createTourValidation),
  handleCreateTour,
];

// GET SINGLE TOUR
const handleGetTour = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const tour = await prisma.tour.findUnique({
      include: {
        destination: {
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

    if (!tour) {
      throw new NotFoundError('Tour not found');
    }

    if (!tour.destination) {
      throw new NotFoundError('Tour destination not found');
    }

    const response: ITourResponse = {
      createdAt: tour.createdAt,
      description: tour.description,
      destination: tour.destination,
      duration: tour.duration,
      endDate: tour.endDate,
      guestsBooked: tour.guestsBooked,
      id: tour.id,
      maxGuests: tour.maxGuests,
      name: tour.name,
      price: tour.price,
      startDate: tour.startDate,
      status: tour.status,
      type: tour.type,
      updatedAt: tour.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Tour retrieved successfully',
    });
  },
);

export const getTour: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Tour ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleGetTour,
];

// UPDATE TOUR
const handleUpdateTour = asyncHandler(
  async (
    req: Request<{ id?: string }, {}, Partial<ITourInput>>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const {
      description,
      destinationId,
      endDate,
      maxGuests,
      name,
      price,
      startDate,
      type,
    } = req.body;

    if (!id) {
      throw new NotFoundError('Tour ID is required');
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      throw new NotFoundError('Invalid tour ID');
    }

    try {
      const existingTour = await prisma.tour.findUnique({
        include: {
          bookings: {
            select: { id: true },
          },
          destination: {
            select: { id: true },
          },
        },
        where: { id: parsedId },
      });

      if (!existingTour) {
        throw new NotFoundError('Tour not found');
      }

      const now = new Date();
      const hasBookings = existingTour.bookings.length > 0;
      const bookedGuests = existingTour.guestsBooked;

      if (existingTour.startDate <= now) {
        throw new BadRequestError(
          'Cannot update tour that has already started',
        );
      }

      if (existingTour.endDate <= now) {
        throw new BadRequestError('Cannot update tour that has already ended');
      }

      const newStartDate = startDate
        ? new Date(startDate)
        : existingTour.startDate;
      const newEndDate = endDate ? new Date(endDate) : existingTour.endDate;

      if (startDate && new Date(startDate) <= now) {
        throw new BadRequestError('Start date must be in the future');
      }

      if (endDate && new Date(endDate) <= now) {
        throw new BadRequestError('End date must be in the future');
      }

      if (newEndDate <= newStartDate) {
        throw new BadRequestError('End date must be after start date');
      }

      if (destinationId !== undefined) {
        const destination = await prisma.destination.findUnique({
          where: { id: destinationId },
        });

        if (!destination) {
          throw new NotFoundError('Destination not found');
        }

        const currentDestinationId = existingTour.destination?.id;
        if (hasBookings && destinationId !== currentDestinationId) {
          throw new BadRequestError(
            'Cannot change tour destination when bookings exist. Please cancel all bookings first or create a new tour.',
          );
        }
      }

      if (maxGuests !== undefined) {
        if (maxGuests < bookedGuests) {
          throw new BadRequestError(
            `Cannot reduce max guests to ${maxGuests}. ${bookedGuests} guests are already booked. Minimum capacity allowed is ${bookedGuests}.`,
          );
        }
      }

      let calculatedDuration: number | undefined;
      if (startDate !== undefined || endDate !== undefined) {
        const durationInDays = Math.ceil(
          (newEndDate.getTime() - newStartDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        calculatedDuration = durationInDays;
      }

      const updateData: any = {};

      if (name !== undefined) {
        updateData.name = name;
      }
      if (description !== undefined) {
        updateData.description = description;
      }
      if (type !== undefined) {
        updateData.type = type;
      }
      if (calculatedDuration !== undefined) {
        updateData.duration = calculatedDuration;
      }
      if (price !== undefined) {
        updateData.price = price;
      }
      if (maxGuests !== undefined) {
        updateData.maxGuests = maxGuests;
      }
      if (startDate !== undefined) {
        updateData.startDate = newStartDate;
      }
      if (endDate !== undefined) {
        updateData.endDate = newEndDate;
      }
      if (destinationId !== undefined) {
        updateData.destinationId = destinationId;
      }

      const updatedTour = await prisma.tour.update({
        data: updateData,
        include: {
          destination: {
            select: {
              city: true,
              country: true,
              id: true,
              name: true,
            },
          },
        },
        where: { id: parsedId },
      });

      const response: ITourResponse = {
        createdAt: updatedTour.createdAt,
        description: updatedTour.description,
        destination: updatedTour.destination,
        duration: updatedTour.duration,
        endDate: updatedTour.endDate,
        guestsBooked: updatedTour.guestsBooked,
        id: updatedTour.id,
        maxGuests: updatedTour.maxGuests,
        name: updatedTour.name,
        price: updatedTour.price,
        startDate: updatedTour.startDate,
        status: updatedTour.status,
        type: updatedTour.type,
        updatedAt: updatedTour.updatedAt,
      };

      res.status(HTTP_STATUS_CODES.OK).json({
        data: response,
        message: 'Tour updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

export const updateTour: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Tour ID must be a positive integer'),
  ...validationMiddleware.create(updateTourValidation),
  handleUpdateTour,
];

// DELETE SINGLE TOUR
const handleDeleteTour = asyncHandler(
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
      throw new UnauthorizedError('Only admins and agents can delete tours');
    }

    if (!id) {
      throw new NotFoundError('Tour ID is required');
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      throw new NotFoundError('Invalid tour ID');
    }

    const tour = await prisma.tour.findUnique({
      include: { bookings: true },
      where: { id: parsedId },
    });

    if (!tour) {
      throw new NotFoundError('Tour not found');
    }

    const now = new Date();

    if (tour.startDate <= now) {
      throw new BadRequestError('Cannot delete tour that has already started');
    }

    if (tour.endDate <= now) {
      throw new BadRequestError('Cannot delete tour that has already ended');
    }

    if (tour.status === 'ONGOING') {
      throw new BadRequestError('Cannot delete tour with status "ONGOING"');
    }

    if (tour.status === 'COMPLETED') {
      throw new BadRequestError('Cannot delete tour with status "COMPLETED"');
    }

    if (tour.bookings.length > 0) {
      throw new BadRequestError(
        'Cannot delete tour with existing bookings. Please cancel or reassign bookings first.',
      );
    }

    if (tour.guestsBooked > 0) {
      throw new BadRequestError(
        `Cannot delete tour with ${tour.guestsBooked} booked guest(s). Please cancel all bookings first.`,
      );
    }

    await prisma.tour.delete({
      where: { id: parsedId },
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Tour deleted successfully',
    });
  },
);

export const deleteTour: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Tour ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleDeleteTour,
];

// GET ALL TOURS
const handleGetAllTours = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const destinationId = req.query.destinationId as string | undefined;
    const country = req.query.country as string | undefined;
    const city = req.query.city as string | undefined;
    const minPrice = req.query.minPrice as string | undefined;
    const maxPrice = req.query.maxPrice as string | undefined;
    const minDuration = req.query.minDuration as string | undefined;
    const maxDuration = req.query.maxDuration as string | undefined;
    const minGuests = req.query.minGuests as string | undefined;
    const maxGuests = req.query.maxGuests as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const availableOnly = req.query.availableOnly === 'true';
    const search = req.query.search as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder =
      (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const whereClause: any = {};

    if (type) {
      whereClause.type = type;
    }

    if (status) {
      whereClause.status = status;
    }

    if (destinationId || country || city) {
      whereClause.destination = {};

      if (destinationId) {
        whereClause.destination.id = parseInt(destinationId);
      }

      if (country) {
        whereClause.destination.country = {
          contains: country,
          mode: 'insensitive',
        };
      }

      if (city) {
        whereClause.destination.city = {
          contains: city,
          mode: 'insensitive',
        };
      }
    }

    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) {
        const parsedMinPrice = parseFloat(minPrice);
        if (!isNaN(parsedMinPrice)) {
          whereClause.price.gte = parsedMinPrice;
        }
      }
      if (maxPrice) {
        const parsedMaxPrice = parseFloat(maxPrice);
        if (!isNaN(parsedMaxPrice)) {
          whereClause.price.lte = parsedMaxPrice;
        }
      }
    }

    if (minDuration || maxDuration) {
      whereClause.duration = {};
      if (minDuration) {
        const parsedMinDuration = parseInt(minDuration);
        if (!isNaN(parsedMinDuration)) {
          whereClause.duration.gte = parsedMinDuration;
        }
      }
      if (maxDuration) {
        const parsedMaxDuration = parseInt(maxDuration);
        if (!isNaN(parsedMaxDuration)) {
          whereClause.duration.lte = parsedMaxDuration;
        }
      }
    }

    if (minGuests || maxGuests) {
      const guestsFilter: any = {};
      if (minGuests) {
        const parsedMinGuests = parseInt(minGuests);
        if (!isNaN(parsedMinGuests)) {
          guestsFilter.gte = parsedMinGuests;
        }
      }
      if (maxGuests) {
        const parsedMaxGuests = parseInt(maxGuests);
        if (!isNaN(parsedMaxGuests)) {
          guestsFilter.lte = parsedMaxGuests;
        }
      }
      whereClause.maxGuests = guestsFilter;
    }

    if (startDate || endDate) {
      if (startDate) {
        whereClause.startDate = {
          gte: new Date(startDate),
        };
      }
      if (endDate) {
        whereClause.endDate = {
          lte: new Date(endDate),
        };
      }
    }

    if (availableOnly) {
      whereClause.guestsBooked = {
        lt: prisma.tour.fields.maxGuests,
      };
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          destination: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const orderByClause: any = {};

    const validSortFields = [
      'createdAt',
      'updatedAt',
      'startDate',
      'endDate',
      'price',
      'duration',
      'maxGuests',
      'guestsBooked',
      'name',
    ];

    if (validSortFields.includes(sortBy)) {
      orderByClause[sortBy] = sortOrder;
    } else {
      orderByClause.createdAt = 'desc';
    }

    const [tours, total] = await Promise.all([
      prisma.tour.findMany({
        include: {
          destination: {
            select: {
              city: true,
              country: true,
              id: true,
              name: true,
            },
          },
        },
        orderBy: orderByClause,
        skip,
        take: limit,
        where: whereClause,
      }),
      prisma.tour.count({ where: whereClause }),
    ]);

    const response: ITourResponse[] = tours.map((tour) => {
      return {
        createdAt: tour.createdAt,
        description: tour.description,
        destination: tour.destination,
        duration: tour.duration,
        endDate: tour.endDate,
        guestsBooked: tour.guestsBooked,
        id: tour.id,
        maxGuests: tour.maxGuests,
        name: tour.name,
        price: tour.price,
        startDate: tour.startDate,
        status: tour.status,
        type: tour.type,
        updatedAt: tour.updatedAt,
      };
    });

    const paginatedResponse = {
      data: response,
      message: 'Tours retrieved successfully',
      meta: {
        limit,
        page,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json(paginatedResponse);
  },
);

export const getAllTours: RequestHandler[] = [
  ...validationMiddleware.create(getAllToursValidation),
  handleGetAllTours,
];

export const deleteAllTours = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized access');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Admin privileges required');
    }

    const tourCount = await prisma.tour.count();

    if (tourCount === 0) {
      throw new BadRequestError('No tours to delete');
    }

    const tours = await prisma.tour.findMany({
      include: {
        bookings: {
          include: {
            payment: true,
          },
        },
      },
    });

    const toursWithConfirmedBookings: number[] = [];
    const toursWithCompletedPayments: number[] = [];
    const ongoingTours: number[] = [];
    const toursAlreadyStarted: number[] = [];

    const now = new Date();

    tours.forEach((tour) => {
      const hasConfirmedBookings = tour.bookings.some(
        (booking) => booking.status === 'CONFIRMED',
      );

      if (hasConfirmedBookings) {
        toursWithConfirmedBookings.push(tour.id);
      }

      const hasCompletedPayments = tour.bookings.some(
        (booking) => booking.payment && booking.payment.status === 'COMPLETED',
      );

      if (hasCompletedPayments) {
        toursWithCompletedPayments.push(tour.id);
      }

      if (tour.status === 'ONGOING') {
        ongoingTours.push(tour.id);
      }

      if (tour.startDate <= now && tour.endDate >= now) {
        ongoingTours.push(tour.id);
      } else if (tour.startDate <= now) {
        toursAlreadyStarted.push(tour.id);
      }
    });

    const blockingIssues: string[] = [];

    if (toursWithConfirmedBookings.length > 0) {
      blockingIssues.push(
        `${toursWithConfirmedBookings.length} tour${toursWithConfirmedBookings.length > 1 ? 's' : ''} with confirmed bookings`,
      );
    }

    if (toursWithCompletedPayments.length > 0) {
      blockingIssues.push(
        `${toursWithCompletedPayments.length} tour${toursWithCompletedPayments.length > 1 ? 's' : ''} with completed payments`,
      );
    }

    if (ongoingTours.length > 0) {
      blockingIssues.push(
        `${ongoingTours.length} ongoing tour${ongoingTours.length > 1 ? 's' : ''}`,
      );
    }

    if (toursAlreadyStarted.length > 0) {
      blockingIssues.push(
        `${toursAlreadyStarted.length} tour${toursAlreadyStarted.length > 1 ? 's' : ''} already started`,
      );
    }

    // If any blocking issues exist, throw error
    if (blockingIssues.length > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete tours: ${blockingIssues.join(', ')} must be cancelled or resolved first`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.tour.deleteMany({});
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        deletedCount: tours.length,
      },
      message: `Successfully deleted ${tours.length} tour${tours.length > 1 ? 's' : ''}`,
    });
  },
);

const handleUpdateTourStatus = asyncHandler(
  async (
    req: Request<{ id?: string }, {}, { status: TourStatus }>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const { status: newStatus } = req.body;
    const user = req.user!;

    if (!['ADMIN', 'AGENT'].includes(user.role)) {
      throw new UnauthorizedError('Only ADMIN or AGENT can update tour status');
    }

    const tourId = parseInt(id!, 10);
    if (isNaN(tourId)) throw new BadRequestError('Invalid tour ID');

    const tour = await prisma.tour.findUnique({
      include: {
        bookings: {
          include: { payment: true },
        },
      },
      where: { id: tourId },
    });
    if (!tour) throw new NotFoundError('Tour not found');

    const current = tour.status;
    if (newStatus === current) {
      throw new BadRequestError('New status is identical to current status');
    }

    const now = new Date();

    let allow = false;
    const updateData: any = { status: newStatus };

    if (current === 'UPCOMING') {
      if (newStatus === 'ONGOING') {
        if (tour.startDate > now)
          throw new BadRequestError('Cannot start tour before its start date');
        const pendingPayments = tour.bookings.some(
          (b) => b.payment?.status === 'PENDING',
        );
        if (pendingPayments)
          throw new BadRequestError('Cannot start tour with pending payments');
        allow = true;
      } else if (newStatus === 'CANCELLED') {
        const paidBookings = tour.bookings.some(
          (b) => b.payment?.status === 'COMPLETED',
        );
        if (paidBookings)
          throw new BadRequestError(
            'Cannot cancel tour with completed payments',
          );
        allow = true;
      }
    } else if (current === 'ONGOING') {
      if (newStatus === 'COMPLETED') {
        if (tour.endDate > now)
          throw new BadRequestError('Cannot complete tour before its end date');
        updateData.endDate = now;
        allow = true;
      } else if (newStatus === 'CANCELLED') {
        throw new BadRequestError('Cannot cancel an ongoing tour');
      }
    } else if (current === 'COMPLETED') {
      if (newStatus === 'CANCELLED') {
        throw new BadRequestError('Cannot cancel a completed tour');
      }
    } else if (current === 'CANCELLED') {
      if (newStatus === 'UPCOMING') {
        if (tour.startDate <= now)
          throw new BadRequestError(
            'Cannot reactivate tour - start date has passed',
          );
        allow = true;
      }
    }

    if (!allow)
      throw new BadRequestError(
        `Invalid status transition from ${current} to ${newStatus}`,
      );

    const updated = await prisma.tour.update({
      data: updateData,
      include: {
        destination: {
          select: { city: true, country: true, id: true, name: true },
        },
      },
      where: { id: tourId },
    });

    if (newStatus === 'CANCELLED') {
      await prisma.booking.updateMany({
        data: { status: 'CANCELLED' },
        where: { status: { in: ['PENDING', 'CONFIRMED'] }, tourId },
      });
    }

    logger.info(
      `Tour ${tour.name} (${tourId}) status changed from ${current} to ${newStatus} by ${user.role} ${user.id}`,
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        destination: updated.destination,
        endDate: updated.endDate,
        id: updated.id,
        name: updated.name,
        startDate: updated.startDate,
        status: updated.status,
      },
      message: 'Tour status updated successfully',
    });
  },
);

export const updateTourStatus: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Tour ID must be a positive integer'),
  ...validationMiddleware.create([
    body('status')
      .isIn(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'])
      .withMessage('Invalid tour status'),
  ]),
  handleUpdateTourStatus,
];
