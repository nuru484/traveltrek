// src/controllers/hotelController.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { param } from 'express-validator';
import prisma from '../config/prismaClient';
import validationMiddleware from '../middlewares/validation';
import {
  asyncHandler,
  NotFoundError,
  BadRequestError,
} from '../middlewares/error-handler';
import { HTTP_STATUS_CODES } from '../config/constants';
import {
  IHotelInput,
  IHotelResponse,
  IHotelsPaginatedResponse,
  IHotelQueryParams,
} from 'types/hotel.types';
import multerUpload from '../config/multer';
import conditionalCloudinaryUpload from '../middlewares/conditional-cloudinary-upload';
import { CLOUDINARY_UPLOAD_OPTIONS } from '../config/constants';
import { cloudinaryService } from '../config/claudinary';
import {
  createHotelValidation,
  updateHotelValidation,
  getHotelsValidation,
  hotelPhotoValidation,
} from '../validations/hotel-validation';

/**
 * Create a new hotel
 */
const handleCreateHotel = asyncHandler(
  async (
    req: Request<{}, {}, IHotelInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const {
      name,
      description,
      address,
      phone,
      starRating,
      amenities,
      destinationId,
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
        name,
        description,
        address,
        phone,
        starRating: parsedStarRating,
        amenities: amenities || [],
        photo: typeof photoUrl === 'string' ? photoUrl : null,
        destination: { connect: { id: Number(destinationId) } },
      },

      include: {
        destination: {
          select: {
            id: true,
            name: true,
            description: true,
            country: true,
            city: true,
          },
        },
        rooms: {
          select: {
            id: true,
            roomType: true,
            description: true,
            photo: true,
            pricePerNight: true,
          },
        },
      },
    });

    const response: IHotelResponse = {
      message: 'Hotel created successfully',
      data: {
        id: hotel.id,
        name: hotel.name,
        description: hotel.description,
        address: hotel.address,
        phone: hotel.phone,
        starRating: hotel.starRating,
        amenities: hotel.amenities,
        photo: hotel.photo,
        rooms: hotel.rooms,
        destination: {
          id: hotel.destination?.id,
          name: hotel.destination?.name,
          description: hotel.destination?.description,
          country: hotel.destination?.country,
          city: hotel.destination?.city,
        },
        createdAt: hotel.createdAt,
        updatedAt: hotel.updatedAt,
      },
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
 * Get a single hotel by ID
 */
const handleGetHotel = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(id) },
      include: {
        destination: {
          select: {
            id: true,
            name: true,
            description: true,
            country: true,
            city: true,
          },
        },
        rooms: {
          select: {
            id: true,
            roomType: true,
            description: true,
            photo: true,
            pricePerNight: true,
          },
        },
      },
    });

    if (!hotel) {
      throw new NotFoundError('Hotel not found');
    }

    const response: IHotelResponse = {
      message: 'Hotel retrieved successfully',
      data: {
        id: hotel.id,
        name: hotel.name,
        description: hotel.description,
        address: hotel.address,
        phone: hotel.phone,
        starRating: hotel.starRating,
        amenities: hotel.amenities,
        photo: hotel.photo,
        rooms: hotel.rooms,
        destination: hotel.destination,
        createdAt: hotel.createdAt,
        updatedAt: hotel.updatedAt,
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

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
      name,
      description,
      address,
      phone,
      starRating,
      amenities,
      destinationId,
    } = req.body;

    if (!id) {
      throw new NotFoundError('Hotel ID is required');
    }

    let uploadedImageUrl: string | undefined;
    let oldPhoto: string | null = null;

    try {
      const existingHotel = await prisma.hotel.findUnique({
        where: { id: Number(id) },
        select: { photo: true },
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
        where: { id: Number(id) },
        data: updateData,
        include: {
          destination: {
            select: {
              id: true,
              name: true,
              description: true,
              country: true,
              city: true,
            },
          },
          rooms: {
            select: {
              id: true,
              roomType: true,
              photo: true,
              description: true,
              pricePerNight: true,
            },
          },
        },
      });

      if (uploadedImageUrl && oldPhoto && oldPhoto !== uploadedImageUrl) {
        try {
          await cloudinaryService.deleteImage(oldPhoto);
        } catch (cleanupError) {
          console.warn('Failed to clean up old hotel photo:', cleanupError);
        }
      }

      const response: IHotelResponse = {
        message: 'Hotel updated successfully',
        data: {
          id: updatedHotel.id,
          name: updatedHotel.name,
          description: updatedHotel.description,
          address: updatedHotel.address,
          phone: updatedHotel.phone,
          starRating: updatedHotel.starRating,
          amenities: updatedHotel.amenities,
          photo: updatedHotel.photo,
          rooms: updatedHotel.rooms,
          destination: updatedHotel.destination,
          createdAt: updatedHotel.createdAt,
          updatedAt: updatedHotel.updatedAt,
        },
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
 * Get all hotels with pagination and filtering
 */
const handleGetAllHotels = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {
      page = 1,
      limit = 10,
      search,
      destinationId,
      city,
      country,
      starRating,
      minStarRating,
      maxStarRating,
      amenities,
      sortBy = 'createdAt',
      sortOrder = 'desc',
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
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          destination: {
            select: {
              id: true,
              name: true,
              description: true,
              country: true,
              city: true,
            },
          },
          rooms: {
            select: {
              id: true,
              roomType: true,
              description: true,
              photo: true,
              pricePerNight: true,
            },
          },
        },
      }),
      prisma.hotel.count({ where }),
    ]);

    const hotelData = hotels.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      phone: hotel.phone,
      starRating: hotel.starRating,
      amenities: hotel.amenities,
      photo: hotel.photo,
      rooms: hotel.rooms,
      destination: hotel.destination,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
    }));

    const response: IHotelsPaginatedResponse = {
      message: 'Hotels retrieved successfully',
      data: hotelData,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
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
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
        where: { destinationId: parseInt(destinationId) },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          destination: {
            select: {
              id: true,
              name: true,
              description: true,
              country: true,
              city: true,
            },
          },
          rooms: {
            select: {
              id: true,
              roomType: true,
              description: true,
              photo: true,
              pricePerNight: true,
            },
          },
        },
      }),
      prisma.hotel.count({
        where: { destinationId: parseInt(destinationId) },
      }),
    ]);

    const hotelData = hotels.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      phone: hotel.phone,
      starRating: hotel.starRating,
      amenities: hotel.amenities,
      photo: hotel.photo,
      rooms: hotel.rooms,
      destination: hotel.destination,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
    }));

    const response: IHotelsPaginatedResponse = {
      message: 'Hotels retrieved successfully',
      data: hotelData,
      meta: {
        total,
        page,
        limit,
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
    next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      throw new NotFoundError('Hotel ID is required');
    }

    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(id) },
      include: {
        rooms: true,
        destination: true,
      },
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

/**
 * Delete all hotels with photo cleanup
 */
export const deleteAllHotels = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const hotelCount = await prisma.hotel.count();

    if (hotelCount === 0) {
      throw new BadRequestError('No hotels found to delete.');
    }

    const hotels = await prisma.hotel.findMany({
      include: {
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
        destination: true,
      },
    });

    const hotelsWithActiveBookings: number[] = [];
    const hotelsWithRooms: number[] = [];
    const deletableHotels: typeof hotels = [];

    hotels.forEach((hotel) => {
      const hasActiveBookings = hotel.rooms.some(
        (room) => room.bookings && room.bookings.length > 0,
      );

      if (hasActiveBookings) {
        hotelsWithActiveBookings.push(hotel.id);
      } else if (hotel.rooms.length > 0) {
        hotelsWithRooms.push(hotel.id);
      } else {
        deletableHotels.push(hotel);
      }
    });

    if (deletableHotels.length === 0) {
      const errorMessages: string[] = [];

      if (hotelsWithActiveBookings.length > 0) {
        errorMessages.push(
          `${hotelsWithActiveBookings.length} hotel(s) have rooms with active bookings (PENDING or CONFIRMED) and cannot be deleted.`,
        );
      }

      if (hotelsWithRooms.length > 0) {
        errorMessages.push(
          `${hotelsWithRooms.length} hotel(s) have rooms that must be deleted first.`,
        );
      }

      throw new BadRequestError(
        `No hotels can be deleted. ${errorMessages.join(' ')}`,
      );
    }

    if (hotelsWithActiveBookings.length > 0 || hotelsWithRooms.length > 0) {
      console.warn(
        `Skipping ${hotelsWithActiveBookings.length + hotelsWithRooms.length} hotel(s): ` +
          `${hotelsWithActiveBookings.length} with active bookings, ` +
          `${hotelsWithRooms.length} with rooms.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.hotel.deleteMany({
        where: {
          id: { in: deletableHotels.map((h) => h.id) },
        },
      });
    });

    const cleanupPromises = deletableHotels
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

    const responseMessage = [
      `Successfully deleted ${deletableHotels.length} hotel(s).`,
    ];

    if (hotelsWithActiveBookings.length > 0) {
      responseMessage.push(
        `Skipped ${hotelsWithActiveBookings.length} hotel(s) with active bookings.`,
      );
    }

    if (hotelsWithRooms.length > 0) {
      responseMessage.push(
        `Skipped ${hotelsWithRooms.length} hotel(s) with rooms.`,
      );
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: responseMessage.join(' '),
      deleted: deletableHotels.length,
      skipped: {
        total: hotels.length - deletableHotels.length,
        withActiveBookings: hotelsWithActiveBookings.length,
        withRooms: hotelsWithRooms.length,
      },
      deletedHotelIds: deletableHotels.map((h) => h.id),
    });
  },
);

export const getHotel: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Hotel ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleGetHotel,
];

export const deleteHotel: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Hotel ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleDeleteHotel,
];

export const getHotelsByDestination: RequestHandler[] = [
  param('destinationId')
    .isInt({ min: 1 })
    .withMessage('Destination ID must be a positive integer'),
  handleGetHotelsByDestination,
];
