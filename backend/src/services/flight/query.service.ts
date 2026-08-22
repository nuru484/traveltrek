// src/services/flight/query.service.ts
//
// Flight read paths: fetch one, the authed filtered/sorted listing, the
// public (unauthenticated) bookable-inventory listing, and the aggregated
// dashboard stats. buildWhere is local to the authed listing.
import {
  BookingStatus,
  FlightStatus,
  PaymentStatus,
  type Prisma,
} from '#config/prismaClient.js';
import { NotFoundError } from '#middlewares/error-handler.js';
import {
  type FlightDeps,
  type FlightListParams,
  type PublicFlightListParams,
} from '#services/flight/shared.js';
import {
  flightSummaryInclude,
  type FlightWithSummaryRelations,
} from '#utils/mappers/flight.mapper.js';

export const makeFlightQueryService = (d: FlightDeps) => {
  const { clock, prisma } = d;

  const getFlightById = async (
    id: number,
  ): Promise<FlightWithSummaryRelations> => {
    // findFirst so soft-deleted flights 404 instead of being returned.
    const flight = await prisma.flight.findFirst({
      include: flightSummaryInclude,
      where: { id },
    });
    if (!flight) throw new NotFoundError('Flight not found');
    return flight;
  };

  const buildWhere = (params: FlightListParams): Prisma.FlightWhereInput => {
    const where: Prisma.FlightWhereInput = {};

    if (params.search) {
      where.OR = [
        { flightNumber: { contains: params.search, mode: 'insensitive' } },
        { airline: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.airline) {
      where.airline = { contains: params.airline, mode: 'insensitive' };
    }

    if (params.originId !== undefined) {
      where.originId = params.originId;
    }

    if (params.destinationId !== undefined) {
      where.destinationId = params.destinationId;
    }

    if (params.flightClass) {
      where.flightClass = params.flightClass;
    }

    if (params.departureFrom || params.departureTo) {
      where.departure = {
        ...(params.departureFrom && { gte: new Date(params.departureFrom) }),
        ...(params.departureTo && { lte: new Date(params.departureTo) }),
      };
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.price = {
        ...(params.minPrice !== undefined && { gte: params.minPrice }),
        ...(params.maxPrice !== undefined && { lte: params.maxPrice }),
      };
    }

    if (params.maxDuration !== undefined) {
      where.duration = { lte: params.maxDuration };
    }

    if (params.maxStops !== undefined) {
      where.stops = { lte: params.maxStops };
    }

    if (params.minSeats !== undefined) {
      where.seatsAvailable = { gte: params.minSeats };
    }

    return where;
  };

  const listFlights = async (
    params: FlightListParams,
  ): Promise<{ flights: FlightWithSummaryRelations[]; total: number }> => {
    const where = buildWhere(params);
    const orderBy: Prisma.FlightOrderByWithRelationInput = {
      [params.sortBy]: params.sortOrder,
    };

    const [flights, total] = await Promise.all([
      prisma.flight.findMany({
        include: flightSummaryInclude,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.flight.count({ where }),
    ]);

    return { flights, total };
  };

  /**
   * Public (unauthenticated) browse listing: bookable inventory only —
   * SCHEDULED flights that have not departed yet, soonest departure first.
   * Modest filters (search, origin, destination); everything else stays on
   * the authed listing.
   */
  const listPublicFlights = async (
    params: PublicFlightListParams,
  ): Promise<{ flights: FlightWithSummaryRelations[]; total: number }> => {
    const where: Prisma.FlightWhereInput = {
      departure: { gt: clock.now() },
      status: FlightStatus.SCHEDULED,
    };
    if (params.originId !== undefined) where.originId = params.originId;
    if (params.destinationId !== undefined) {
      where.destinationId = params.destinationId;
    }
    if (params.search) {
      where.OR = [
        { airline: { contains: params.search, mode: 'insensitive' } },
        { flightNumber: { contains: params.search, mode: 'insensitive' } },
        {
          destination: {
            name: { contains: params.search, mode: 'insensitive' },
          },
        },
        { origin: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [flights, total] = await Promise.all([
      prisma.flight.findMany({
        include: flightSummaryInclude,
        orderBy: { departure: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.flight.count({ where }),
    ]);

    return { flights, total };
  };

  /** Aggregated dashboard numbers for the flights overview. */
  const getFlightStats = async () => {
    const now = clock.now();

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
      prisma.flight.aggregate({ _sum: { seatsAvailable: true } }),
      prisma.flight.aggregate({ _sum: { capacity: true } }),
      prisma.flight.aggregate({ _avg: { price: true } }),
      prisma.flight.groupBy({
        _count: true,
        by: ['flightClass'],
        orderBy: { _count: { flightClass: 'desc' } },
      }),
      prisma.flight.groupBy({
        _count: true,
        by: ['airline'],
        orderBy: { _count: { airline: 'desc' } },
        take: 10,
      }),
      prisma.flight.groupBy({
        _count: true,
        _sum: { capacity: true, seatsAvailable: true },
        by: ['status'],
      }),
      prisma.flight.count({ where: { status: FlightStatus.SCHEDULED } }),
      prisma.flight.count({ where: { status: FlightStatus.DEPARTED } }),
      prisma.flight.count({ where: { status: FlightStatus.LANDED } }),
      prisma.flight.count({ where: { status: FlightStatus.DELAYED } }),
      prisma.flight.count({ where: { status: FlightStatus.CANCELLED } }),
      prisma.flight.count({
        where: {
          departure: { gte: now },
          status: FlightStatus.SCHEDULED,
        },
      }),
      prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: {
          flightId: { not: null },
          payment: { status: PaymentStatus.COMPLETED },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
      }),
      prisma.flight.count({
        where: {
          bookings: {
            some: {
              status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
            },
          },
        },
      }),
    ]);

    const totalCapacity = totalBookedSeats._sum.capacity ?? 0;
    const totalAvailable = totalSeats._sum.seatsAvailable ?? 0;
    const totalBooked = totalCapacity - totalAvailable;
    const occupancyRate =
      totalCapacity > 0
        ? ((totalBooked / totalCapacity) * 100).toFixed(2)
        : '0.00';
    const revenue = totalRevenue._sum.totalPrice ?? 0;

    const statusBreakdown = flightsByStatus.map((item) => {
      const capacity = item._sum.capacity ?? 0;
      const available = item._sum.seatsAvailable ?? 0;
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

    return {
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
            ? Math.round((revenue / flightsWithBookings) * 100) / 100
            : 0,
        revenuePerSeat:
          totalBooked > 0 ? Math.round((revenue / totalBooked) * 100) / 100 : 0,
        totalRevenue: Math.round(revenue * 100) / 100,
      },

      operationalMetrics: {
        cancellationRate:
          totalFlights > 0
            ? `${((cancelledFlights / totalFlights) * 100).toFixed(2)}%`
            : '0.00%',
        cancelledFlights,
        completedFlights: landedFlights,
        completionRate:
          totalFlights > 0
            ? `${((landedFlights / totalFlights) * 100).toFixed(2)}%`
            : '0.00%',
        delayedFlights,
        delayRate:
          totalFlights > 0
            ? `${((delayedFlights / totalFlights) * 100).toFixed(2)}%`
            : '0.00%',
        onTimeFlights: scheduledFlights + departedFlights,
      },

      overview: {
        averagePrice: Math.round((averagePrice._avg.price ?? 0) * 100) / 100,
        flightsWithBookings,
        occupancyRate: `${occupancyRate}%`,
        totalCapacity,
        totalFlights,
        totalRevenue: Math.round(revenue * 100) / 100,
        totalSeatsAvailable: totalAvailable,
        totalSeatsBooked: totalBooked,
      },

      topAirlines: flightsByAirline.map((item) => ({
        airline: item.airline,
        count: item._count,
      })),
    };
  };

  return {
    getFlightById,
    getFlightStats,
    listFlights,
    listPublicFlights,
  };
};
