// test/helpers/factories.ts
//
// Record factories for integration tests. Each creates a real row in the test
// database with sensible defaults; pass overrides for what the test cares
// about. bcrypt cost is 4 — fast, and login still verifies for real.
import bcrypt from 'bcrypt';

import prisma, { Role, TourType } from '../../src/config/prismaClient';

export const TEST_PASSWORD = 'Password1!';

let uniq = 0;
const next = () => ++uniq;

export const createUser = async (
  overrides: {
    email?: string;
    name?: string;
    password?: string;
    phone?: null | string;
    role?: Role;
  } = {},
) => {
  const n = next();
  return prisma.user.create({
    data: {
      address: '123 Test Street',
      email: overrides.email ?? `user-${n}@test.local`,
      name: overrides.name ?? `Test User ${n}`,
      password: await bcrypt.hash(overrides.password ?? TEST_PASSWORD, 4),
      phone: overrides.phone === undefined ? `2335500${1000 + n}` : overrides.phone,
      role: overrides.role ?? Role.CUSTOMER,
    },
  });
};

export const createAdmin = (overrides: Parameters<typeof createUser>[0] = {}) =>
  createUser({ role: Role.ADMIN, ...overrides });

export const createAgent = (overrides: Parameters<typeof createUser>[0] = {}) =>
  createUser({ role: Role.AGENT, ...overrides });

export const createDestination = (
  overrides: Partial<{ city: string; country: string; name: string }> = {},
) => {
  const n = next();
  return prisma.destination.create({
    data: {
      city: overrides.city ?? `City ${n}`,
      country: overrides.country ?? 'Ghana',
      description: 'A lovely test destination',
      name: overrides.name ?? `Destination ${n}`,
    },
  });
};

export const createTour = async (
  overrides: Partial<{
    destinationId: number;
    endDate: Date;
    maxGuests: number;
    name: string;
    price: number;
    startDate: Date;
  }> = {},
) => {
  const n = next();
  const destinationId =
    overrides.destinationId ?? (await createDestination()).id;
  const startDate =
    overrides.startDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const endDate =
    overrides.endDate ?? new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  return prisma.tour.create({
    data: {
      description: 'A scenic test tour',
      destinationId,
      duration: 7,
      endDate,
      maxGuests: overrides.maxGuests ?? 10,
      name: overrides.name ?? `Tour ${n}`,
      price: overrides.price ?? 500,
      startDate,
      type: TourType.ADVENTURE,
    },
  });
};

export const createHotel = async (
  overrides: Partial<{ destinationId: number; name: string }> = {},
) => {
  const n = next();
  const destinationId =
    overrides.destinationId ?? (await createDestination()).id;
  return prisma.hotel.create({
    data: {
      address: `${n} Hotel Road`,
      destinationId,
      name: overrides.name ?? `Hotel ${n}`,
      starRating: 4,
    },
  });
};

export const createRoom = async (
  overrides: Partial<{
    hotelId: number;
    pricePerNight: number;
    totalRooms: number;
  }> = {},
) => {
  const hotelId = overrides.hotelId ?? (await createHotel()).id;
  return prisma.room.create({
    data: {
      capacity: 2,
      hotelId,
      pricePerNight: overrides.pricePerNight ?? 150,
      roomType: 'DOUBLE',
      totalRooms: overrides.totalRooms ?? 5,
    },
  });
};

export const createFlight = async (
  overrides: Partial<{
    capacity: number;
    destinationId: number;
    originId: number;
    price: number;
  }> = {},
) => {
  const n = next();
  const originId = overrides.originId ?? (await createDestination()).id;
  const destinationId =
    overrides.destinationId ?? (await createDestination()).id;
  const departure = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return prisma.flight.create({
    data: {
      airline: 'Test Air',
      arrival: new Date(departure.getTime() + 6 * 60 * 60 * 1000),
      capacity: overrides.capacity ?? 100,
      departure,
      destinationId,
      duration: 360,
      flightClass: 'ECONOMY',
      flightNumber: `TA-${1000 + n}`,
      originId,
      price: overrides.price ?? 800,
      seatsAvailable: overrides.capacity ?? 100,
      stops: 0,
    },
  });
};
