import { NextFunction, Request, RequestHandler, Response } from 'express';
import { IRoom, IRoomInput, IRoomQueryParams } from 'types/room.types';

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
} from '../middlewares/error-handler';
import logger from '../utils/logger';

/**
 * Helper function to calculate available and booked rooms for a date range
 */
const getAvailableRoomsCount = async (
  roomId: number,
  startDate: Date,
  endDate: Date,
): Promise<{ availableRooms: number; bookedRooms: number }> => {
  const room = await prisma.room.findUnique({
    select: { totalRooms: true },
    where: { id: roomId },
  });

  if (!room) return { availableRooms: 0, bookedRooms: 0 };

  // Get overlapping bookings that are CONFIRMED or PENDING
  const overlappingBookings = await prisma.booking.findMany({
    select: {
      numberOfRooms: true,
    },
    where: {
      AND: [{ startDate: { lt: endDate } }, { endDate: { gt: startDate } }],
      roomId: roomId,
      status: {
        in: ['CONFIRMED', 'PENDING'],
      },
    },
  });

  // Sum up the total number of rooms booked
  const bookedRooms = overlappingBookings.reduce(
    (sum, booking) => sum + booking.numberOfRooms,
    0,
  );

  return {
    availableRooms: room.totalRooms - bookedRooms,
    bookedRooms: bookedRooms,
  };
};

/**
 * Create a new room
 */
const handleCreateRoom = asyncHandler(
  async (
    req: Request<{}, {}, IRoomInput>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const {
      amenities,
      capacity,
      description,
      hotelId,
      pricePerNight,
      roomType,
      totalRooms,
    } = req.body;

    const hotel = await prisma.hotel.findUnique({
      select: { description: true, id: true, name: true },
      where: { id: Number(hotelId) },
    });

    if (!hotel) {
      throw new NotFoundError('Hotel not found');
    }

    const existingRoom = await prisma.room.findFirst({
      where: {
        hotelId: Number(hotelId),
        roomType: roomType.trim(),
      },
    });

    if (existingRoom) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Room type '${roomType}' already exists for this hotel`,
      );
    }

    const photoUrl = req.body.roomPhoto;

    const room = await prisma.room.create({
      data: {
        amenities: amenities || [],
        capacity: Number(capacity),
        description: description?.trim() || null,
        hotel: { connect: { id: Number(hotelId) } },
        photo: typeof photoUrl === 'string' ? photoUrl : null,
        pricePerNight: Number(pricePerNight),
        roomType: roomType.trim(),
        totalRooms: Number(totalRooms),
      },
      include: {
        hotel: {
          select: {
            description: true,
            id: true,
            name: true,
          },
        },
      },
    });

    // Calculate rooms available and booked for the current date
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const { availableRooms, bookedRooms } = await getAvailableRoomsCount(
      room.id,
      now,
      tomorrow,
    );

    const response: IRoom = {
      amenities: room.amenities,
      capacity: room.capacity,
      createdAt: room.createdAt,
      description: room.description,
      hotel: room.hotel,
      id: room.id,
      photo: room.photo,
      pricePerNight: room.pricePerNight,
      roomsAvailable: availableRooms,
      roomsBooked: bookedRooms,
      roomType: room.roomType,
      totalRooms: room.totalRooms,
      updatedAt: room.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.CREATED).json({
      data: response,
      message: 'Room created successfully',
    });
  },
);

/**
 * Middleware array for room creation
 */
const createRoom: RequestHandler[] = [
  multerUpload.single('roomPhoto'),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'roomPhoto'),
  handleCreateRoom,
];

/**
 * Get a single room by ID
 */
const getRoom = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { endDate, startDate } = req.query;

    const room = await prisma.room.findUnique({
      include: {
        hotel: {
          select: {
            description: true,
            id: true,
            name: true,
          },
        },
      },
      where: { id: parseInt(id) },
    });

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    // Calculate rooms available and booked based on provided dates or default to current date
    let start = new Date();
    let end = new Date();
    end.setDate(start.getDate() + 1);

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestError('Invalid date format');
      }

      if (start >= end) {
        throw new BadRequestError('End date must be after start date');
      }
    }

    const { availableRooms, bookedRooms } = await getAvailableRoomsCount(
      room.id,
      start,
      end,
    );

    const response: IRoom = {
      amenities: room.amenities,
      capacity: room.capacity,
      createdAt: room.createdAt,
      description: room.description,
      hotel: room.hotel,
      id: room.id,
      photo: room.photo,
      pricePerNight: room.pricePerNight,
      roomsAvailable: availableRooms,
      roomsBooked: bookedRooms,
      roomType: room.roomType,
      totalRooms: room.totalRooms,
      updatedAt: room.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Room retrieved successfully',
    });
  },
);

/**
 * Update a room with photo handling
 */
const handleUpdateRoom = asyncHandler(
  async (
    req: Request<{ id?: string }, {}, Partial<IRoomInput>>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const {
      amenities,
      capacity,
      description,
      hotelId,
      pricePerNight,
      roomType,
      totalRooms,
    } = req.body;

    // Validate room ID
    if (!id) {
      throw new NotFoundError('Room ID is required');
    }

    const parsedId = parseInt(id);

    if (isNaN(parsedId)) {
      throw new BadRequestError('Invalid room ID');
    }

    let uploadedImageUrl: string | undefined;
    let oldPhoto: null | string = null;

    try {
      const existingRoom = await prisma.room.findUnique({
        include: {
          bookings: {
            select: {
              id: true,
              numberOfRooms: true,
              status: true,
            },
            where: {
              OR: [{ status: 'PENDING' }, { status: 'CONFIRMED' }],
            },
          },
        },
        where: { id: parsedId },
      });

      if (!existingRoom) {
        throw new NotFoundError('Room not found');
      }

      oldPhoto = existingRoom.photo;
      const hasActiveBookings = existingRoom.bookings.length > 0;

      const totalBookedRooms = existingRoom.bookings.reduce(
        (sum, booking) => sum + booking.numberOfRooms,
        0,
      );

      if (hotelId !== undefined && hotelId !== existingRoom.hotelId) {
        if (hasActiveBookings) {
          throw new BadRequestError(
            'Cannot change hotel when active bookings exist. Please cancel all bookings first or create a new room.',
          );
        }

        // Verify new hotel exists
        const hotel = await prisma.hotel.findUnique({
          select: { description: true, id: true, name: true },
          where: { id: Number(hotelId) },
        });

        if (!hotel) {
          throw new NotFoundError('Hotel not found');
        }
      }

      // Validate room type change
      if (roomType !== undefined && roomType.trim() !== existingRoom.roomType) {
        if (hasActiveBookings) {
          throw new BadRequestError(
            'Cannot change room type when active bookings exist. Please cancel all bookings first or create a new room.',
          );
        }

        // Check for duplicate room type in the hotel
        const duplicateRoom = await prisma.room.findFirst({
          where: {
            hotelId:
              hotelId !== undefined ? Number(hotelId) : existingRoom.hotelId,
            id: { not: parsedId },
            roomType: roomType.trim(),
          },
        });

        if (duplicateRoom) {
          throw new CustomError(
            HTTP_STATUS_CODES.CONFLICT,
            `Room type '${roomType}' already exists for this hotel`,
          );
        }
      }

      // Validate price change
      if (pricePerNight !== undefined) {
        if (hasActiveBookings) {
          const priceChange =
            Math.abs(
              (pricePerNight - existingRoom.pricePerNight) /
                existingRoom.pricePerNight,
            ) * 100;
          if (priceChange > 50) {
            logger.warn(
              `Large price change (${priceChange.toFixed(2)}%) on room ${parsedId} with active bookings`,
            );
          }
        }
      }

      if (capacity !== undefined) {
        if (hasActiveBookings && capacity < existingRoom.capacity) {
          throw new BadRequestError(
            'Cannot reduce room capacity when active bookings exist. Guests may have booked based on the current capacity.',
          );
        }
      }

      if (totalRooms !== undefined) {
        if (totalRooms < totalBookedRooms) {
          throw new BadRequestError(
            `Cannot reduce total rooms to ${totalRooms}. ${totalBookedRooms} rooms are currently booked across all reservations. Minimum total rooms allowed is ${totalBookedRooms}.`,
          );
        }
      }

      // Prepare update data
      const updateData: any = {};

      if (hotelId !== undefined) {
        updateData.hotel = { connect: { id: Number(hotelId) } };
      }
      if (roomType !== undefined) {
        updateData.roomType = roomType.trim();
      }
      if (pricePerNight !== undefined) {
        updateData.pricePerNight = Number(pricePerNight);
      }
      if (capacity !== undefined) {
        updateData.capacity = Number(capacity);
      }
      if (totalRooms !== undefined) {
        updateData.totalRooms = Number(totalRooms);
      }
      if (description !== undefined) {
        updateData.description = description?.trim() || null;
      }
      if (amenities !== undefined) {
        updateData.amenities = amenities || [];
      }

      if (req.body.roomPhoto && typeof req.body.roomPhoto === 'string') {
        updateData.photo = req.body.roomPhoto;
        uploadedImageUrl = req.body.roomPhoto;
      }

      const updatedRoom = await prisma.room.update({
        data: updateData,
        include: {
          hotel: {
            select: {
              description: true,
              id: true,
              name: true,
            },
          },
        },
        where: { id: parsedId },
      });

      if (uploadedImageUrl && oldPhoto && oldPhoto !== uploadedImageUrl) {
        try {
          await cloudinaryService.deleteImage(oldPhoto);
        } catch (cleanupError) {
          logger.warn('Failed to clean up old room photo:', cleanupError);
        }
      }

      // Calculate rooms available and booked for the current date
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const { availableRooms, bookedRooms } = await getAvailableRoomsCount(
        updatedRoom.id,
        now,
        tomorrow,
      );

      const response: IRoom = {
        amenities: updatedRoom.amenities,
        capacity: updatedRoom.capacity,
        createdAt: updatedRoom.createdAt,
        description: updatedRoom.description,
        hotel: updatedRoom.hotel,
        id: updatedRoom.id,
        photo: updatedRoom.photo,
        pricePerNight: updatedRoom.pricePerNight,
        roomsAvailable: availableRooms,
        roomsBooked: bookedRooms,
        roomType: updatedRoom.roomType,
        totalRooms: updatedRoom.totalRooms,
        updatedAt: updatedRoom.updatedAt,
      };

      res.status(HTTP_STATUS_CODES.OK).json({
        data: response,
        message: 'Room updated successfully',
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

/**
 * Middleware array for room update
 */
const updateRoom: RequestHandler[] = [
  multerUpload.single('roomPhoto'),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'roomPhoto'),
  handleUpdateRoom,
];

/**
 * Get all rooms with pagination and filtering
 */
const getAllRooms = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const {
      amenities,
      endDate,
      hotelId,
      limit = 10,
      maxCapacity,
      maxPrice,
      minCapacity,
      minPrice,
      page = 1,
      roomType,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
    }: IRoomQueryParams = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {};

    if (hotelId) {
      where.hotelId = Number(hotelId);
    }

    if (roomType) {
      where.roomType = {
        contains: roomType,
        mode: 'insensitive',
      };
    }

    if (minPrice || maxPrice) {
      where.pricePerNight = {};
      if (minPrice) where.pricePerNight.gte = Number(minPrice);
      if (maxPrice) where.pricePerNight.lte = Number(maxPrice);
    }

    if (minCapacity || maxCapacity) {
      where.capacity = {};
      if (minCapacity) where.capacity.gte = Number(minCapacity);
      if (maxCapacity) where.capacity.lte = Number(maxCapacity);
    }

    if (amenities) {
      const amenitiesArray = Array.isArray(amenities) ? amenities : [amenities];
      where.amenities = {
        hasEvery: amenitiesArray,
      };
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (
      sortBy === 'pricePerNight' ||
      sortBy === 'capacity' ||
      sortBy === 'createdAt'
    ) {
      orderBy[sortBy] = sortOrder === 'asc' ? 'asc' : 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        include: {
          hotel: {
            select: {
              description: true,
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        skip,
        take: Number(limit),
        where,
      }),
      prisma.room.count({ where }),
    ]);

    // Calculate rooms available and booked for each room
    let start = new Date();
    let end = new Date();
    end.setDate(start.getDate() + 1);

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestError('Invalid date format');
      }

      if (start >= end) {
        throw new BadRequestError('End date must be after start date');
      }
    }

    const response: IRoom[] = await Promise.all(
      rooms.map(async (room) => {
        const { availableRooms, bookedRooms } = await getAvailableRoomsCount(
          room.id,
          start,
          end,
        );
        return {
          amenities: room.amenities,
          capacity: room.capacity,
          createdAt: room.createdAt,
          description: room.description,
          hotel: room.hotel,
          id: room.id,
          photo: room.photo,
          pricePerNight: room.pricePerNight,
          roomsAvailable: availableRooms,
          roomsBooked: bookedRooms,
          roomType: room.roomType,
          totalRooms: room.totalRooms,
          updatedAt: room.updatedAt,
        };
      }),
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Rooms retrieved successfully',
      meta: {
        limit: Number(limit),
        page: Number(page),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  },
);

/**
 * Check room availability for a specific date range
 */
const checkRoomAvailability = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const { endDate, startDate } = req.query;

    if (!startDate || !endDate) {
      throw new BadRequestError('Start date and end date are required');
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      throw new BadRequestError('Invalid room ID');
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestError('Invalid date format');
    }

    if (start >= end) {
      throw new BadRequestError('End date must be after start date');
    }

    const { availableRooms, bookedRooms } = await getAvailableRoomsCount(
      parsedId,
      start,
      end,
    );

    const room = await prisma.room.findUnique({
      select: { roomType: true, totalRooms: true },
      where: { id: parsedId },
    });

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        availableRooms,
        bookedRooms,
        endDate: end,
        isAvailable: availableRooms > 0,
        roomId: parsedId,
        roomType: room.roomType,
        startDate: start,
        totalRooms: room.totalRooms,
      },
      message: 'Room availability checked successfully',
    });
  },
);

/**
 * Delete a room with photo cleanup and comprehensive validations
 */
const deleteRoom = asyncHandler(
  async (
    req: Request<{ id?: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      throw new NotFoundError('Room ID is required');
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      throw new BadRequestError('Invalid room ID');
    }

    try {
      const room = await prisma.room.findUnique({
        include: {
          bookings: {
            include: {
              payment: {
                select: {
                  amount: true,
                  id: true,
                  status: true,
                },
              },
            },
          },
          hotel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        where: { id: parsedId },
      });

      if (!room) {
        throw new NotFoundError('Room not found');
      }

      const bookingsWithCompletedPayment = room.bookings.filter(
        (booking) => booking.payment && booking.payment.status === 'COMPLETED',
      );

      if (bookingsWithCompletedPayment.length > 0) {
        throw new BadRequestError(
          `Cannot delete room with ${bookingsWithCompletedPayment.length} completed payment(s). Rooms with payment history cannot be deleted for financial and legal compliance.`,
        );
      }

      // Check for active bookings (PENDING or CONFIRMED)
      const activeBookings = room.bookings.filter(
        (booking) =>
          booking.status === 'PENDING' || booking.status === 'CONFIRMED',
      );

      if (activeBookings.length > 0) {
        throw new BadRequestError(
          `Cannot delete room with ${activeBookings.length} active booking(s). Please cancel or complete all bookings first.`,
        );
      }

      // Check for future bookings (bookings with check-in dates in the future)
      const now = new Date();
      const futureBookings = room.bookings.filter(
        (booking) => booking.startDate && new Date(booking.startDate) > now,
      );

      if (futureBookings.length > 0) {
        throw new BadRequestError(
          `Cannot delete room with ${futureBookings.length} future booking(s). Please handle all future reservations first.`,
        );
      }

      // Check for ongoing bookings (currently checked in)
      const ongoingBookings = room.bookings.filter((booking) => {
        if (!booking.startDate || !booking.endDate) return false;
        const checkIn = new Date(booking.startDate);
        const checkOut = new Date(booking.endDate);
        return (
          checkIn <= now && checkOut >= now && booking.status === 'CONFIRMED'
        );
      });

      if (ongoingBookings.length > 0) {
        throw new BadRequestError(
          `Cannot delete room with ${ongoingBookings.length} ongoing booking(s). Guests are currently checked in.`,
        );
      }

      // Check for pending payments
      const pendingPayments = room.bookings.filter(
        (booking) => booking.payment && booking.payment.status === 'PENDING',
      );

      if (pendingPayments.length > 0) {
        throw new BadRequestError(
          `Cannot delete room with ${pendingPayments.length} pending payment(s). Please resolve all payments first.`,
        );
      }

      // Check if this is the last room for the hotel
      const hotelRoomsCount = await prisma.room.count({
        where: {
          hotelId: room.hotelId,
        },
      });

      if (hotelRoomsCount <= 1) {
        logger.warn(
          `Deleting the last room (ID: ${parsedId}) for hotel "${room.hotel.name}" (ID: ${room.hotelId}). Hotel will have no available rooms.`,
        );
        throw new BadRequestError(
          `Cannot delete the last room of hotel "${room.hotel.name}". A hotel must have at least one room.`,
        );
      } else if (hotelRoomsCount <= 3) {
        logger.warn(
          `Deleting room (ID: ${parsedId}) - only ${hotelRoomsCount - 1} room(s) will remain for hotel "${room.hotel.name}"`,
        );
      }

      // Log historical bookings that will be orphaned
      const completedBookings = room.bookings.filter(
        (booking) =>
          booking.status === 'COMPLETED' || booking.status === 'CANCELLED',
      );

      if (completedBookings.length > 0) {
        logger.info(
          `Deleting room (ID: ${parsedId}) with ${completedBookings.length} historical booking(s). These bookings will remain for record-keeping.`,
        );
      }

      // Perform deletion
      await prisma.room.delete({
        where: { id: parsedId },
      });

      // Clean up photo from Cloudinary
      if (room.photo) {
        try {
          await cloudinaryService.deleteImage(room.photo);
        } catch (cleanupError) {
          logger.warn(
            'Failed to clean up room photo from Cloudinary:',
            cleanupError,
          );
        }
      }

      logger.info(
        `Room deleted successfully - ID: ${parsedId}, Type: ${room.roomType}, Hotel: ${room.hotel.name} (ID: ${room.hotelId})`,
      );

      res.status(HTTP_STATUS_CODES.OK).json({
        data: {
          deletedAt: new Date().toISOString(),
          historicalBookingsCount: completedBookings.length,
          hotelName: room.hotel.name,
          id: room.id,
          roomType: room.roomType,
        },
        message: 'Room deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Delete all rooms with photo cleanup and comprehensive validations
 */
const deleteAllRooms = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const now = new Date();

    const rooms = await prisma.room.findMany({
      include: {
        bookings: {
          include: {
            payment: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
        hotel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (rooms.length === 0) {
      throw new NotFoundError('No rooms found to delete');
    }

    // Categorize rooms and identify issues
    const deletableRooms: typeof rooms = [];
    const roomsWithIssues: {
      reasons: string[];
      room: (typeof rooms)[0];
    }[] = [];

    for (const room of rooms) {
      const issues: string[] = [];

      // 1. Check for completed payments
      const hasCompletedPayment = room.bookings.some(
        (booking) => booking.payment && booking.payment.status === 'COMPLETED',
      );
      if (hasCompletedPayment) {
        issues.push('has completed payment(s)');
      }

      // 2. Check for active bookings
      const hasActiveBooking = room.bookings.some(
        (booking) =>
          booking.status === 'PENDING' || booking.status === 'CONFIRMED',
      );
      if (hasActiveBooking) {
        issues.push('has active booking(s)');
      }

      // 3. Check for future bookings
      const hasFutureBooking = room.bookings.some(
        (booking) => booking.startDate && new Date(booking.startDate) > now,
      );
      if (hasFutureBooking) {
        issues.push('has future booking(s)');
      }

      // 4. Check for ongoing bookings
      const hasOngoingBooking = room.bookings.some((booking) => {
        if (!booking.startDate || !booking.endDate) return false;
        const checkIn = new Date(booking.startDate);
        const checkOut = new Date(booking.endDate);
        return (
          checkIn <= now && checkOut >= now && booking.status === 'CONFIRMED'
        );
      });
      if (hasOngoingBooking) {
        issues.push('has ongoing booking(s) - guests currently checked in');
      }

      // 5. Check for pending payments
      const hasPendingPayment = room.bookings.some(
        (booking) => booking.payment && booking.payment.status === 'PENDING',
      );
      if (hasPendingPayment) {
        issues.push('has pending payment(s)');
      }

      // Categorize room
      if (issues.length === 0) {
        deletableRooms.push(room);
      } else {
        roomsWithIssues.push({ reasons: issues, room });
      }
    }

    // If no rooms can be deleted, provide detailed feedback
    if (deletableRooms.length === 0) {
      const issuesSummary = roomsWithIssues
        .slice(0, 5)
        .map(
          ({ reasons, room }) =>
            `Room ${room.id} (${room.roomType} at ${room.hotel.name}): ${reasons.join(', ')}`,
        )
        .join('; ');

      throw new BadRequestError(
        `Cannot delete any rooms. All ${rooms.length} room(s) have blocking conditions: ${issuesSummary}${roomsWithIssues.length > 5 ? '...' : ''}`,
      );
    }

    const hotelRoomCounts = new Map<number, number>();
    for (const room of rooms) {
      hotelRoomCounts.set(
        room.hotelId,
        (hotelRoomCounts.get(room.hotelId) || 0) + 1,
      );
    }

    const hotelsLosingAllRooms: string[] = [];
    for (const room of deletableRooms) {
      const currentCount = hotelRoomCounts.get(room.hotelId) || 0;
      const deletableForHotel = deletableRooms.filter(
        (r) => r.hotelId === room.hotelId,
      ).length;

      if (currentCount === deletableForHotel) {
        if (!hotelsLosingAllRooms.includes(room.hotel.name)) {
          hotelsLosingAllRooms.push(room.hotel.name);
        }
      }
    }

    if (hotelsLosingAllRooms.length > 0) {
      logger.warn(
        `The following hotel(s) will have NO rooms after this operation: ${hotelsLosingAllRooms.join(', ')}`,
      );
      throw new BadRequestError(
        `Cannot proceed: Hotels [${hotelsLosingAllRooms.join(', ')}] would have no rooms remaining.`,
      );
    }

    // Perform deletion
    await prisma.room.deleteMany({
      where: {
        id: { in: deletableRooms.map((r) => r.id) },
      },
    });

    // Clean up photos from Cloudinary
    const cleanupPromises = deletableRooms
      .filter((room) => room.photo)
      .map(async (room) => {
        try {
          await cloudinaryService.deleteImage(room.photo!);
        } catch (cleanupError) {
          logger.warn(`Failed to clean up photo ${room.photo}:`, cleanupError);
        }
      });

    await Promise.allSettled(cleanupPromises);

    logger.info(
      `Bulk room deletion completed - Deleted: ${deletableRooms.length}, Skipped: ${roomsWithIssues.length}`,
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        deleted: deletableRooms.length,
        hotelsAffected: new Set(deletableRooms.map((r) => r.hotel.name)).size,
        skipped: roomsWithIssues.length,
        total: rooms.length,
        ...(hotelsLosingAllRooms.length > 0 && {
          warning: `The following hotels now have no rooms: ${hotelsLosingAllRooms.join(', ')}`,
        }),
        ...(roomsWithIssues.length > 0 && {
          skippedDetails: roomsWithIssues
            .slice(0, 10)
            .map(({ reasons, room }) => ({
              hotel: room.hotel.name,
              reasons,
              roomId: room.id,
              roomType: room.roomType,
            })),
        }),
      },
      message: `Successfully deleted ${deletableRooms.length} room(s)`,
    });
  },
);

export {
  checkRoomAvailability,
  createRoom,
  deleteAllRooms,
  deleteRoom,
  getAllRooms,
  getRoom,
  updateRoom,
};
