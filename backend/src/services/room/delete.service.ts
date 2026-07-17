// src/services/room/delete.service.ts
//
// Room delete: the legacy guard chain in order — completed payments, active
// bookings, future bookings, ongoing stays, pending payments, and the hotel's
// last room — then soft-delete + photo cleanup. Historical bookings never
// block; they are only counted for the response.
import { BookingStatus, PaymentStatus } from '#config/prismaClient.js';
import {
  BadRequestError,
  NotFoundError,
} from '#middlewares/error-handler.js';
import { type RoomCore } from '#services/room/core.js';
import {
  type RoomDeleteSummary,
  type RoomDeps,
} from '#services/room/shared.js';

export const makeRoomDeleteService = (d: RoomDeps, core: RoomCore) => {
  const { clock, logger, prisma } = d;
  const { cleanupPhoto } = core;

  const deleteRoom = async (id: number): Promise<RoomDeleteSummary> => {
    // Nested reads are not auto-scoped; soft-deleted bookings don't block.
    const room = await prisma.room.findFirst({
      include: {
        bookings: {
          include: {
            payment: { select: { amount: true, id: true, status: true } },
          },
          where: { deletedAt: null },
        },
        hotel: { select: { id: true, name: true } },
      },
      where: { id },
    });
    if (!room) throw new NotFoundError('Room not found');

    const bookingsWithCompletedPayment = room.bookings.filter(
      (booking) => booking.payment?.status === PaymentStatus.COMPLETED,
    );
    if (bookingsWithCompletedPayment.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${bookingsWithCompletedPayment.length} completed payment(s). Rooms with payment history cannot be deleted for financial and legal compliance.`,
      );
    }

    const activeBookings = room.bookings.filter(
      (booking) =>
        booking.status === BookingStatus.PENDING ||
        booking.status === BookingStatus.CONFIRMED,
    );
    if (activeBookings.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${activeBookings.length} active booking(s). Please cancel or complete all bookings first.`,
      );
    }

    const now = clock.now();
    const futureBookings = room.bookings.filter(
      (booking) => booking.startDate && new Date(booking.startDate) > now,
    );
    if (futureBookings.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${futureBookings.length} future booking(s). Please handle all future reservations first.`,
      );
    }

    // Ongoing bookings: guests currently checked in.
    const ongoingBookings = room.bookings.filter((booking) => {
      if (!booking.startDate || !booking.endDate) return false;
      const checkIn = new Date(booking.startDate);
      const checkOut = new Date(booking.endDate);
      return (
        checkIn <= now &&
        checkOut >= now &&
        booking.status === BookingStatus.CONFIRMED
      );
    });
    if (ongoingBookings.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${ongoingBookings.length} ongoing booking(s). Guests are currently checked in.`,
      );
    }

    const pendingPayments = room.bookings.filter(
      (booking) => booking.payment?.status === PaymentStatus.PENDING,
    );
    if (pendingPayments.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${pendingPayments.length} pending payment(s). Please resolve all payments first.`,
      );
    }

    // A hotel must keep at least one room.
    const hotelRoomsCount = await prisma.room.count({
      where: { hotelId: room.hotelId },
    });
    if (hotelRoomsCount <= 1) {
      logger.warn(
        `Deleting the last room (ID: ${id}) for hotel "${room.hotel.name}" (ID: ${room.hotelId}). Hotel will have no available rooms.`,
      );
      throw new BadRequestError(
        `Cannot delete the last room of hotel "${room.hotel.name}". A hotel must have at least one room.`,
      );
    } else if (hotelRoomsCount <= 3) {
      logger.warn(
        `Deleting room (ID: ${id}) - only ${hotelRoomsCount - 1} room(s) will remain for hotel "${room.hotel.name}"`,
      );
    }

    // Historical bookings survive the delete for record-keeping.
    const completedBookings = room.bookings.filter(
      (booking) =>
        booking.status === BookingStatus.COMPLETED ||
        booking.status === BookingStatus.CANCELLED,
    );
    if (completedBookings.length > 0) {
      logger.info(
        `Deleting room (ID: ${id}) with ${completedBookings.length} historical booking(s). These bookings will remain for record-keeping.`,
      );
    }

    // Soft delete: the row survives (deletedAt set); scoped reads hide it.
    await prisma.room.update({
      data: { deletedAt: clock.now() },
      where: { id },
    });

    if (room.photo) {
      await cleanupPhoto(
        room.photo,
        'Failed to clean up room photo from Cloudinary',
      );
    }

    logger.info(
      `Room deleted successfully - ID: ${id}, Type: ${room.roomType}, Hotel: ${room.hotel.name} (ID: ${room.hotelId})`,
    );

    return {
      deletedAt: clock.now().toISOString(),
      historicalBookingsCount: completedBookings.length,
      hotelName: room.hotel.name,
      id: room.id,
      roomType: room.roomType,
    };
  };

  return { deleteRoom };
};
