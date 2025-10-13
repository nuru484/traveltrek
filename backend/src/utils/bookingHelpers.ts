// src/utils/bookingHelpers.ts
import prisma from "../config/prismaClient";

/**
 * Calculate payment deadline based on check-in time
 */
export function calculatePaymentDeadline(checkInDate: Date): {
  deadline: Date;
  requiresImmediatePayment: boolean;
} {
  const now = new Date();
  const hoursUntilCheckIn =
    (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilCheckIn <= 2) {
    // Same-day or very soon: 30 minutes
    return {
      deadline: new Date(now.getTime() + 30 * 60 * 1000),
      requiresImmediatePayment: true,
    };
  } else if (hoursUntilCheckIn <= 24) {
    // Within 24 hours: 2 hours
    return {
      deadline: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      requiresImmediatePayment: true,
    };
  } else {
    // Advance booking: 24 hours before check-in
    const deadline = new Date(checkInDate);
    deadline.setHours(deadline.getHours() - 24);
    return {
      deadline,
      requiresImmediatePayment: false,
    };
  }
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const nights = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  return nights;
}

/**
 * Calculate total price for room booking
 */
export function calculateRoomBookingPrice(
  pricePerNight: number,
  numberOfNights: number,
  numberOfRooms: number,
): number {
  return pricePerNight * numberOfNights * numberOfRooms;
}

/**
 * Validate booking dates
 */
export function validateBookingDates(
  startDate: Date,
  endDate: Date,
): { valid: boolean; error?: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const checkIn = new Date(startDate);
  checkIn.setHours(0, 0, 0, 0);

  const checkOut = new Date(endDate);
  checkOut.setHours(0, 0, 0, 0);

  // Cannot book in the past (before today)
  if (checkIn < now) {
    return {
      valid: false,
      error: 'Check-in date cannot be in the past',
    };
  }

  // Check-out must be after check-in
  if (checkOut <= checkIn) {
    return {
      valid: false,
      error: 'Check-out date must be after check-in date',
    };
  }

  // Minimum 1 night
  const nights = calculateNights(checkIn, checkOut);
  if (nights < 1) {
    return {
      valid: false,
      error: 'Booking must be for at least 1 night',
    };
  }

  return { valid: true };
}

/**
 * Check if room is available for given dates
 */
export async function checkRoomAvailability(
  roomId: number,
  startDate: Date,
  endDate: Date,
  numberOfRoomsNeeded: number,
): Promise<{ available: boolean; availableRooms: number }> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    return { available: false, availableRooms: 0 };
  }

  // Find overlapping bookings
  const overlappingBookings = await prisma.booking.findMany({
    where: {
      roomId: roomId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      OR: [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      ],
    },
    select: { numberOfRooms: true },
  });

  // Sum up all rooms booked during this period
  const roomsBookedDuringPeriod = overlappingBookings.reduce(
    (sum, booking) => sum + booking.numberOfRooms,
    0,
  );

  const availableRooms = room.totalRooms - roomsBookedDuringPeriod;

  return {
    available: availableRooms >= numberOfRoomsNeeded,
    availableRooms,
  };
}
