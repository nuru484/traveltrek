// src/controllers/hotelController.ts
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { param } from 'express-validator';
import {
  IHotelInput,
  IHotelQueryParams,
  IHotelResponse,
  IHotelsPaginatedResponse,
} from 'types/hotel.types';

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
import {
  createHotelValidation,
  getHotelsValidation,
  hotelPhotoValidation,
  updateHotelValidation,
} from '../validations/hotel-validation';

/**
 * Create a new hotel
 */
const handleCreateHotel = asyncHandler(
  async (
    req: Request<{}, {}, IHotelInput>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const {
      address,
      amenities,
      description,
      destinationId,
      name,
      phone,
      starRating,
    } = req.body;

    const destination = await prisma.destination.findUnique({
      where: { id: Number(destinationId) },
    });

    if (!destination) {
      throw new NotFoundError('Destination not found');
    }

    const photoUrl = req.body.hotelPhoto;

    const parsedStarRating = starRating ? Number(starRating) : 3;

    const hotel = await prisma.hotel.create({
      data: {
        address,
        amenities: amenities || [],
        description,
        destination: { connect: { id: Number(destinationId) } },
        name,
        phone,
        photo: typeof photoUrl === 'string' ? photoUrl : null,
        starRating: parsedStarRating,
      },

      include: {
        destination: {
          select: {
            city: true,
            country: true,
            description: true,
            id: true,
            name: true,
          },
        },
        rooms: {
          select: {
            description: true,
            id: true,
            photo: true,
            pricePerNight: true,
            roomType: true,
          },
        },
      },
    });

    const response: IHotelResponse = {
      data: {
        address: hotel.address,
        amenities: hotel.amenities,
        createdAt: hotel.createdAt,
        description: hotel.description,
        destination: {
          city: hotel.destination?.city,
          country: hotel.destination?.country,
          description: hotel.destination?.description,
          id: hotel.destination?.id,
          name: hotel.destination?.name,
        },
        id: hotel.id,
        name: hotel.name,
        phone: hotel.phone,
        photo: hotel.photo,
        rooms: hotel.rooms,
        starRating: hotel.starRating,
        updatedAt: hotel.updatedAt,
      },
      message: 'Hotel created successfully',
    };

    res.status(HTTP_STATUS_CODES.CREATED).json(response);
  },
);

export const createHotel: RequestHandler[] = [
  multerUpload.single('hotelPhoto'),
  ...validationMiddleware.create([
    ...createHotelValidation,
    ...hotelPhotoValidation,
  ]),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'hotelPhoto'),
  handleCreateHotel,
];

/**
 * Update a hotel with photo handling
 */
const handleUpdateHotel = asyncHandler(
  async (
    req: Request<{ id?: string }, {}, Partial<IHotelInput>>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const {
      address,
      amenities,
      description,
      destinationId,
      name,
      phone,
      starRating,
    } = req.body;

    if (!id) {
      throw new NotFoundError('Hotel ID is required');
    }

    let uploadedImageUrl: string | undefined;
    let oldPhoto: null | string = null;

    try {
      const existingHotel = await prisma.hotel.findUnique({
        select: { photo: true },
        where: { id: Number(id) },
      });

      if (!existingHotel) {
        throw new NotFoundError('Hotel not found');
      }

      oldPhoto = existingHotel.photo;

      if (destinationId) {
        const destination = await prisma.destination.findUnique({
          where: { id: Number(destinationId) },
        });
        if (!destination) {
          throw new NotFoundError('Destination not found');
        }
      }

      const updateData: any = {};

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (address !== undefined) updateData.address = address;
      if (phone !== undefined) updateData.phone = phone;

      if (starRating !== undefined) {
        const parsedStarRating = Number(starRating);

        if (
          parsedStarRating < 1 ||
          parsedStarRating > 5 ||
          isNaN(parsedStarRating)
        ) {
          throw new Error('Star rating must be a number between 1 and 5');
        }

        updateData.starRating = parsedStarRating;
      }

      if (amenities !== undefined) {
        let processedAmenities: string[];

        if (Array.isArray(amenities)) {
          processedAmenities = amenities;
        } else if (typeof amenities === 'object' && amenities !== null) {
          processedAmenities = Object.values(amenities).filter(
            (item): item is string => typeof item === 'string',
          );
        } else if (typeof amenities === 'string') {
          processedAmenities = [amenities];
        } else {
          processedAmenities = [];
        }

        updateData.amenities = processedAmenities;
      }

      if (destinationId !== undefined) {
        const parsedDestinationId = Number(destinationId);

        if (isNaN(parsedDestinationId)) {
          throw new Error('Destination ID must be a valid number');
        }

        updateData.destinationId = parsedDestinationId;
      }

      if (req.body.hotelPhoto && typeof req.body.hotelPhoto === 'string') {
        updateData.photo = req.body.hotelPhoto;
        uploadedImageUrl = req.body.hotelPhoto;
      }

      const updatedHotel = await prisma.hotel.update({
        data: updateData,
        include: {
          destination: {
            select: {
              city: true,
              country: true,
              description: true,
              id: true,
              name: true,
            },
          },
          rooms: {
            select: {
              description: true,
              id: true,
              photo: true,
              pricePerNight: true,
              roomType: true,
            },
          },
        },
        where: { id: Number(id) },
      });

      if (uploadedImageUrl && oldPhoto && oldPhoto !== uploadedImageUrl) {
        try {
          await cloudinaryService.deleteImage(oldPhoto);
        } catch (cleanupError) {
          console.warn('Failed to clean up old hotel photo:', cleanupError);
        }
      }

      const response: IHotelResponse = {
        data: {
          address: updatedHotel.address,
          amenities: updatedHotel.amenities,
          createdAt: updatedHotel.createdAt,
          description: updatedHotel.description,
          destination: updatedHotel.destination,
          id: updatedHotel.id,
          name: updatedHotel.name,
          phone: updatedHotel.phone,
          photo: updatedHotel.photo,
          rooms: updatedHotel.rooms,
          starRating: updatedHotel.starRating,
          updatedAt: updatedHotel.updatedAt,
        },
        message: 'Hotel updated successfully',
      };

      res.status(HTTP_STATUS_CODES.OK).json(response);
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

export const updateHotel: RequestHandler[] = [
  multerUpload.single('hotelPhoto'),
  param('id')
    .isInt({ min: 1 })
    .withMessage('Hotel ID must be a positive integer'),
  ...validationMiddleware.create([
    ...updateHotelValidation,
    ...hotelPhotoValidation,
  ]),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'hotelPhoto'),
  handleUpdateHotel,
];

/**
 * Get a single hotel by ID
 */
const handleGetHotel = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const hotel = await prisma.hotel.findUnique({
      include: {
        destination: {
          select: {
            city: true,
            country: true,
            description: true,
            id: true,
            name: true,
          },
        },
        rooms: {
          select: {
            description: true,
            id: true,
            photo: true,
            pricePerNight: true,
            roomType: true,
          },
        },
      },
      where: { id: parseInt(id) },
    });

    if (!hotel) {
      throw new NotFoundError('Hotel not found');
    }

    const response: IHotelResponse = {
      data: {
        address: hotel.address,
        amenities: hotel.amenities,
        createdAt: hotel.createdAt,
        description: hotel.description,
        destination: hotel.destination,
        id: hotel.id,
        name: hotel.name,
        phone: hotel.phone,
        photo: hotel.photo,
        rooms: hotel.rooms,
        starRating: hotel.starRating,
        updatedAt: hotel.updatedAt,
      },
      message: 'Hotel retrieved successfully',
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

export const getHotel: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Hotel ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleGetHotel,
];

/**
 * Get all hotels with pagination and filtering
 */
const handleGetAllHotels = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const {
      amenities,
      city,
      country,
      destinationId,
      limit = 10,
      maxStarRating,
      minStarRating,
      page = 1,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      starRating,
    }: IHotelQueryParams = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { destination: { city: { contains: search, mode: 'insensitive' } } },
        { destination: { country: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (destinationId) {
      where.destinationId = Number(destinationId);
    }

    if (city) {
      where.destination = {
        ...where.destination,
        city: { contains: city, mode: 'insensitive' },
      };
    }

    if (country) {
      where.destination = {
        ...where.destination,
        country: { contains: country, mode: 'insensitive' },
      };
    }

    if (starRating) {
      where.starRating = Number(starRating);
    }

    if (minStarRating || maxStarRating) {
      where.starRating = {};
      if (minStarRating) where.starRating.gte = Number(minStarRating);
      if (maxStarRating) where.starRating.lte = Number(maxStarRating);
    }

    if (amenities) {
      const amenitiesArray = Array.isArray(amenities) ? amenities : [amenities];
      where.amenities = {
        hasEvery: amenitiesArray,
      };
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [hotels, total] = await Promise.all([
      prisma.hotel.findMany({
        include: {
          destination: {
            select: {
              city: true,
              country: true,
              description: true,
              id: true,
              name: true,
            },
          },
          rooms: {
            select: {
              description: true,
              id: true,
              photo: true,
              pricePerNight: true,
              roomType: true,
            },
          },
        },
        orderBy,
        skip,
        take: limitNum,
        where,
      }),
      prisma.hotel.count({ where }),
    ]);

    const hotelData = hotels.map((hotel) => ({
      address: hotel.address,
      amenities: hotel.amenities,
      createdAt: hotel.createdAt,
      description: hotel.description,
      destination: hotel.destination,
      id: hotel.id,
      name: hotel.name,
      phone: hotel.phone,
      photo: hotel.photo,
      rooms: hotel.rooms,
      starRating: hotel.starRating,
      updatedAt: hotel.updatedAt,
    }));

    const response: IHotelsPaginatedResponse = {
      data: hotelData,
      message: 'Hotels retrieved successfully',
      meta: {
        limit: limitNum,
        page: pageNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

export const getAllHotels: RequestHandler[] = [
  ...validationMiddleware.create(getHotelsValidation),
  handleGetAllHotels,
];

/**
 * Get hotels by destination
 */
const handleGetHotelsByDestination = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { destinationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const destination = await prisma.destination.findUnique({
      where: { id: parseInt(destinationId) },
    });

    if (!destination) {
      throw new NotFoundError('Destination not found');
    }

    const [hotels, total] = await Promise.all([
      prisma.hotel.findMany({
        include: {
          destination: {
            select: {
              city: true,
              country: true,
              description: true,
              id: true,
              name: true,
            },
          },
          rooms: {
            select: {
              description: true,
              id: true,
              photo: true,
              pricePerNight: true,
              roomType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        where: { destinationId: parseInt(destinationId) },
      }),
      prisma.hotel.count({
        where: { destinationId: parseInt(destinationId) },
      }),
    ]);

    const hotelData = hotels.map((hotel) => ({
      address: hotel.address,
      amenities: hotel.amenities,
      createdAt: hotel.createdAt,
      description: hotel.description,
      destination: hotel.destination,
      id: hotel.id,
      name: hotel.name,
      phone: hotel.phone,
      photo: hotel.photo,
      rooms: hotel.rooms,
      starRating: hotel.starRating,
      updatedAt: hotel.updatedAt,
    }));

    const response: IHotelsPaginatedResponse = {
      data: hotelData,
      message: 'Hotels retrieved successfully',
      meta: {
        limit,
        page,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

/**
 * Delete a hotel with photo cleanup
 */
const handleDeleteHotel = asyncHandler(
  async (
    req: Request<{ id?: string }>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      throw new NotFoundError('Hotel ID is required');
    }

    const hotel = await prisma.hotel.findUnique({
      include: {
        destination: true,
        rooms: true,
      },
      where: { id: parseInt(id) },
    });

    if (!hotel) {
      throw new NotFoundError('Hotel not found');
    }

    if (hotel.rooms.length > 0) {
      throw new BadRequestError(
        'Cannot delete hotel with existing rooms. Please remove rooms first.',
      );
    }

    await prisma.hotel.delete({
      where: { id: parseInt(id) },
    });

    if (hotel.photo) {
      try {
        await cloudinaryService.deleteImage(hotel.photo);
      } catch (cleanupError) {
        console.warn(
          'Failed to clean up hotel photo from Cloudinary:',
          cleanupError,
        );
      }
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Hotel deleted successfully',
    });
  },
);

export const deleteHotel: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Hotel ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleDeleteHotel,
];

/**
 * Delete all hotels with photo cleanup
 */
export const deleteAllHotels = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized access');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Admin privileges required');
    }

    const hotelCount = await prisma.hotel.count();

    if (hotelCount === 0) {
      throw new BadRequestError('No hotels to delete');
    }

    const hotels = await prisma.hotel.findMany({
      include: {
        destination: true,
        rooms: {
          include: {
            bookings: {
              where: {
                status: {
                  in: ['PENDING', 'CONFIRMED'],
                },
              },
            },
          },
        },
      },
    });

    const hotelsWithActiveBookings: number[] = [];
    const hotelsWithRooms: number[] = [];

    hotels.forEach((hotel) => {
      const hasActiveBookings = hotel.rooms.some(
        (room) => room.bookings && room.bookings.length > 0,
      );

      if (hasActiveBookings) {
        hotelsWithActiveBookings.push(hotel.id);
      }

      if (hotel.rooms.length > 0) {
        hotelsWithRooms.push(hotel.id);
      }
    });

    const blockingIssues: string[] = [];

    if (hotelsWithRooms.length > 0) {
      blockingIssues.push(
        `${hotelsWithRooms.length} hotel${hotelsWithRooms.length > 1 ? 's' : ''}`,
      );
    }

    if (blockingIssues.length > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete all hotels: ${blockingIssues.join(', ')} have rooms in it, it must be removed first`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.hotel.deleteMany({});
    });

    const cleanupPromises = hotels
      .filter((hotel) => hotel.photo)
      .map(async (hotel) => {
        try {
          await cloudinaryService.deleteImage(hotel.photo!);
        } catch (cleanupError) {
          console.error(
            `Failed to clean up photo for hotel ${hotel.id} (${hotel.name}):`,
            cleanupError,
          );
        }
      });

    await Promise.allSettled(cleanupPromises);

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        deletedCount: hotels.length,
      },
      message: `Successfully deleted ${hotels.length} hotel${hotels.length > 1 ? 's' : ''}`,
    });
  },
);

export const getHotelsByDestination: RequestHandler[] = [
  param('destinationId')
    .isInt({ min: 1 })
    .withMessage('Destination ID must be a positive integer'),
  handleGetHotelsByDestination,
];
