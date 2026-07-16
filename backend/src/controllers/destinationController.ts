// src/controllers/destination/destination-controller.ts
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { param } from 'express-validator';
import {
  IDestinationInput,
  IDestinationResponse,
  IDestinationUpdateInput,
} from 'types/destination.types';

import { cloudinaryService } from '../config/claudinary';
import { HTTP_STATUS_CODES } from '../config/constants';
import { CLOUDINARY_UPLOAD_OPTIONS } from '../config/constants';
import multerUpload from '../config/multer';
import prisma from '../config/prismaClient';
import conditionalCloudinaryUpload from '../middlewares/conditional-cloudinary-upload';
import {
  asyncHandler,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../middlewares/error-handler';
import validationMiddleware from '../middlewares/validation';
import {
  createDestinationValidation,
  destinationPhotoValidation,
  getDestinationsValidation,
  updateDestinationValidation,
} from '../validations/destination-validation';

/**
 * Create a new destination
 */
const handleCreateDestination = asyncHandler(
  async (
    req: Request<{}, {}, IDestinationInput>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { city, country, description, name } = req.body;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
      throw new UnauthorizedError(
        'Only admins and agents can create destinations',
      );
    }

    const photoUrl = req.body.destinationPhoto;

    const destination = await prisma.destination.create({
      data: {
        city,
        country,
        description,
        name,
        photo: typeof photoUrl === 'string' ? photoUrl : null,
      },
    });

    const response: IDestinationResponse = {
      city: destination.city,
      country: destination.country,
      createdAt: destination.createdAt,
      description: destination.description,
      id: destination.id,
      name: destination.name,
      photo: destination.photo,
      updatedAt: destination.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.CREATED).json({
      data: response,
      message: 'Destination created successfully',
    });
  },
);

/**
 * Get a single destination by ID
 */
const handleGetDestination = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;

    const destination = await prisma.destination.findUnique({
      where: { id: parseInt(id) },
    });

    if (!destination) {
      throw new NotFoundError('Destination not found');
    }

    const response: IDestinationResponse = {
      city: destination.city,
      country: destination.country,
      createdAt: destination.createdAt,
      description: destination.description,
      id: destination.id,
      name: destination.name,
      photo: destination.photo,
      updatedAt: destination.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Destination retrieved successfully',
    });
  },
);

/**
 * Update a destination with photo handling
 */
const handleUpdateDestination = asyncHandler(
  async (
    req: Request<{ id?: string }, {}, IDestinationUpdateInput>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const { city, country, description, name } = req.body;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
      throw new UnauthorizedError(
        'Only admins and agents can update destinations',
      );
    }

    if (!id) {
      throw new NotFoundError('Destination ID is required');
    }

    // Track the uploaded image URL for cleanup if needed
    let uploadedImageUrl: string | undefined;
    let oldPhoto: null | string = null;

    try {
      // First, get the current destination to check for existing photo
      const existingDestination = await prisma.destination.findUnique({
        select: { photo: true },
        where: { id: parseInt(id) },
      });

      if (!existingDestination) {
        throw new NotFoundError('Destination not found');
      }

      oldPhoto = existingDestination.photo;

      // Prepare update data
      const updateData: any = {};

      // Only update fields that are provided
      if (name !== undefined) {
        updateData.name = name;
      }
      if (description !== undefined) {
        updateData.description = description;
      }
      if (country !== undefined) {
        updateData.country = country;
      }
      if (city !== undefined) {
        updateData.city = city;
      }

      // Handle photo - it should be a string URL after middleware processing
      if (
        req.body.destinationPhoto &&
        typeof req.body.destinationPhoto === 'string'
      ) {
        updateData.photo = req.body.destinationPhoto;
        uploadedImageUrl = req.body.destinationPhoto;
      }

      // Update destination in database
      const updatedDestination = await prisma.destination.update({
        data: updateData,
        where: { id: parseInt(id) },
      });

      // If we successfully updated with a new photo, clean up the old one
      if (uploadedImageUrl && oldPhoto && oldPhoto !== uploadedImageUrl) {
        try {
          await cloudinaryService.deleteImage(oldPhoto);
        } catch (cleanupError) {
          console.warn(
            'Failed to clean up old destination photo:',
            cleanupError,
          );
          // Don't throw here as the main operation succeeded
        }
      }

      const response: IDestinationResponse = {
        city: updatedDestination.city,
        country: updatedDestination.country,
        createdAt: updatedDestination.createdAt,
        description: updatedDestination.description,
        id: updatedDestination.id,
        name: updatedDestination.name,
        photo: updatedDestination.photo,
        updatedAt: updatedDestination.updatedAt,
      };

      res.status(HTTP_STATUS_CODES.OK).json({
        data: response,
        message: 'Destination updated successfully',
      });
    } catch (error) {
      // If Cloudinary upload succeeded but DB update failed, clean up uploaded image
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

/**
 * Delete a destination with photo cleanup
 */
const handleDeleteDestination = asyncHandler(
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
      throw new UnauthorizedError(
        'Only admins and agents can delete destinations',
      );
    }

    if (!id) {
      throw new NotFoundError('Destination ID is required');
    }

    const destinationId = parseInt(id);

    const destination = await prisma.destination.findUnique({
      include: {
        destinationFlights: true,
        hotels: true,
        originFlights: true,
        tours: true,
      },
      where: { id: destinationId },
    });

    if (!destination) {
      throw new NotFoundError('Destination not found');
    }

    // Check dependencies
    const dependentItems: string[] = [];
    if (destination.hotels.length > 0) dependentItems.push('Hotels');
    if (destination.tours.length > 0) dependentItems.push('Tours');
    if (
      destination.originFlights.length > 0 ||
      destination.destinationFlights.length > 0
    )
      dependentItems.push('Flights');

    if (dependentItems.length > 0) {
      throw new BadRequestError(
        `This destination cannot be deleted because it has associated: ${dependentItems.join(
          ', ',
        )}. Please remove or reassign them before deleting the destination.`,
      );
    }

    // Delete from database
    await prisma.destination.delete({
      where: { id: destinationId },
    });

    // Clean up photo from Cloudinary if it exists
    if (destination.photo) {
      try {
        await cloudinaryService.deleteImage(destination.photo);
      } catch (cleanupError) {
        console.warn(
          'Failed to clean up destination photo from Cloudinary:',
          cleanupError,
        );
        // Don't throw here as the main operation succeeded
      }
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'Destination deleted successfully',
    });
  },
);

/**
 * Get all destinations with pagination and filtering
 */
const handleGetAllDestinations = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Extract search and filter parameters
    const search = req.query.search as string;
    const country = req.query.country as string;
    const city = req.query.city as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    // Build where clause for filtering
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (country) {
      where.country = { contains: country, mode: 'insensitive' };
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    // Build orderBy clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [destinations, total] = await Promise.all([
      prisma.destination.findMany({
        orderBy,
        skip,
        take: limit,
        where,
      }),
      prisma.destination.count({ where }),
    ]);

    const response: IDestinationResponse[] = destinations.map(
      (destination) => ({
        city: destination.city,
        country: destination.country,
        createdAt: destination.createdAt,
        description: destination.description,
        id: destination.id,
        name: destination.name,
        photo: destination.photo,
        updatedAt: destination.updatedAt,
      }),
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Destinations retrieved successfully',
      meta: {
        filters: {
          city,
          country,
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

/**
 * Delete all destinations with photo cleanup
 */
const handleDeleteAllDestinations = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Only admins can delete all destinations');
    }

    const destinations = await prisma.destination.findMany({
      include: {
        destinationFlights: true,
        hotels: true,
        originFlights: true,
        tours: true,
      },
    });

    if (destinations.length === 0) {
      res.status(HTTP_STATUS_CODES.OK).json({
        message: 'No destinations found to delete',
      });
      return;
    }

    const blocked: { deps: string[]; id: number; name: string }[] = [];

    for (const dest of destinations) {
      const deps: string[] = [];
      if (dest.hotels.length > 0) deps.push('Hotels');
      if (dest.tours.length > 0) deps.push('Tours');
      if (dest.originFlights.length > 0 || dest.destinationFlights.length > 0) {
        deps.push('Flights');
      }
      if (deps.length > 0) {
        blocked.push({ deps, id: dest.id, name: dest.name });
      }
    }

    if (blocked.length > 0) {
      throw new BadRequestError(
        `Cannot delete all destinations. ${blocked.length} destination${blocked.length > 1 ? 's have' : ' has'} associated dependencies (Hotels, Tours, or Flights). Please remove these dependencies first.`,
      );
    }

    const photos = destinations
      .map((dest) => dest.photo)
      .filter((photo): photo is string => Boolean(photo));

    await prisma.destination.deleteMany({});

    const cleanupPromises = photos.map(async (photo) => {
      try {
        await cloudinaryService.deleteImage(photo);
      } catch (cleanupError) {
        console.warn(`Failed to clean up photo ${photo}:`, cleanupError);
      }
    });

    await Promise.allSettled(cleanupPromises);

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'All destinations deleted successfully',
    });
  },
);

// Middleware arrays with validations
export const createDestination: RequestHandler[] = [
  multerUpload.single('destinationPhoto'),
  ...validationMiddleware.create([
    ...createDestinationValidation,
    ...destinationPhotoValidation,
  ]),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'destinationPhoto'),
  handleCreateDestination,
];

export const getDestination: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Destination ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleGetDestination,
];

export const updateDestination: RequestHandler[] = [
  multerUpload.single('destinationPhoto'),
  param('id')
    .isInt({ min: 1 })
    .withMessage('Destination ID must be a positive integer'),
  ...validationMiddleware.create([
    ...updateDestinationValidation,
    ...destinationPhotoValidation,
  ]),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'destinationPhoto'),
  handleUpdateDestination,
];

export const deleteDestination: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Destination ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleDeleteDestination,
];

export const getAllDestinations: RequestHandler[] = [
  ...validationMiddleware.create(getDestinationsValidation),
  handleGetAllDestinations,
];

export const deleteAllDestinations: RequestHandler[] = [
  handleDeleteAllDestinations,
];
