import * as bcrypt from 'bcrypt';

import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
} from '../generated/prisma/client';
// Dev-only sample users, bookings, and payments for UI visualisation.
import prisma from '../src/config/prismaClient';

async function run() {
  const password = await bcrypt.hash('Password123!', 10);
  const usersData = [
    {
      address: 'Osu, Accra',
      email: 'amina.fuseini@example.com',
      name: 'Amina Fuseini',
      phone: '233540000001',
      role: Role.CUSTOMER,
    },
    {
      address: 'Ahodwo, Kumasi',
      email: 'kwabena.mensah@example.com',
      name: 'Kwabena Mensah',
      phone: '233540000002',
      role: Role.CUSTOMER,
    },
    {
      email: 'efua.owusu@example.com',
      name: 'Efua Owusu-Ansah',
      phone: '233540000003',
      role: Role.CUSTOMER,
    },
    {
      address: 'Airport City, Accra',
      email: 'yaw.darko@example.com',
      name: 'Yaw Darko',
      phone: '233540000004',
      role: Role.AGENT,
    },
    {
      address: 'Sagnarigu, Tamale',
      email: 'zeinab.alhassan@example.com',
      name: 'Zeinab Alhassan',
      phone: '233540000005',
      role: Role.AGENT,
    },
  ];
  const users = [];
  for (const u of usersData) {
    users.push(
      await prisma.user.upsert({
        create: { ...u, password },
        update: {},
        where: { email: u.email },
      }),
    );
  }
  console.log('users:', users.map((u) => u.id).join(','));

  const [tourA, tourB] = await prisma.tour.findMany({
    orderBy: { id: 'asc' },
    take: 2,
  });
  const [flightA, flightB] = await prisma.flight.findMany({
    orderBy: { id: 'asc' },
    take: 2,
  });
  const rooms = await prisma.room.findMany({ orderBy: { id: 'asc' }, take: 2 });
  const day = 86400000,
    now = Date.now();

  const mk = async (data: object) =>
    prisma.booking.create({ data: data as never });

  const b1 = await mk({
    bookingDate: new Date(now - 6 * day),
    numberOfGuests: 2,
    status: BookingStatus.CONFIRMED,
    totalPrice: tourA.price * 2,
    tourId: tourA.id,
    userId: users[0].id,
  });
  const b2 = await mk({
    bookingDate: new Date(now - 1 * day),
    numberOfGuests: 1,
    paymentDeadline: new Date(now + 2 * day),
    status: BookingStatus.PENDING,
    totalPrice: tourB.price,
    tourId: tourB.id,
    userId: users[1].id,
  });
  const b3 = await mk({
    bookingDate: new Date(now - 3 * day),
    flightId: flightA.id,
    numberOfGuests: 1,
    status: BookingStatus.CONFIRMED,
    totalPrice: flightA.price,
    userId: users[2].id,
  });
  const _b4 = await mk({
    bookingDate: new Date(now - 10 * day),
    flightId: flightB.id,
    numberOfGuests: 1,
    status: BookingStatus.CANCELLED,
    totalPrice: flightB.price,
    userId: users[0].id,
  });
  const b5 = await mk({
    bookingDate: new Date(now - 25 * day),
    endDate: new Date(now - 17 * day),
    numberOfGuests: 2,
    numberOfNights: 3,
    numberOfRooms: 1,
    roomId: rooms[0].id,
    startDate: new Date(now - 20 * day),
    status: BookingStatus.COMPLETED,
    totalPrice: rooms[0].pricePerNight * 3,
    userId: users[1].id,
  });

  await prisma.payment.createMany({
    data: [
      {
        amount: b1.totalPrice,
        bookingId: b1.id,
        paymentDate: new Date(now - 6 * day + 3600000),
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        status: PaymentStatus.COMPLETED,
        transactionReference: 'TT-PAY-0001',
        userId: users[0].id,
      },
      {
        amount: b2.totalPrice,
        bookingId: b2.id,
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        status: PaymentStatus.PENDING,
        transactionReference: 'TT-PAY-0002',
        userId: users[1].id,
      },
      {
        amount: b3.totalPrice,
        bookingId: b3.id,
        paymentDate: new Date(now - 3 * day + 7200000),
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.COMPLETED,
        transactionReference: 'TT-PAY-0003',
        userId: users[2].id,
      },
      {
        amount: b5.totalPrice,
        bookingId: b5.id,
        paymentDate: new Date(now - 24 * day),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.REFUNDED,
        transactionReference: 'TT-PAY-0005',
        userId: users[1].id,
      },
    ],
  });
  console.log('SEEDED bookings + payments');
}
// SEED_WORST_CASE=1 runs only the worst-case rows; default runs the base set.
const job = process.env.SEED_MAXIMIZE
  ? maximize()
  : process.env.SEED_WORST_CASE
    ? worstCase()
    : run();
job
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * SEED_MAXIMIZE=1 — rewrite EVERY existing row (except the admin login) to
 * worst-case content with real prose, so the whole UI renders under maximum
 * stress all the time.
 */
export async function maximize() {
  const destDesc =
    'Stretched along a wide bend of the river where the savannah finally gives way to gallery forest, this district gathers colonial-era trading houses, a labyrinthine night market famous for its charred-pepper suya and hand-dyed indigo cloth, three UNESCO-listed shrine complexes, and a chain of shea-butter cooperatives that welcome visitors at dawn. Most travellers stay a week and still leave a list of things undone, from the canoe crossing at first light to the drumming festivals that close every harvest season.';
  const hotelDesc =
    'Originally built in 1932 as the residence of a cocoa magnate and restored plank by plank over eleven years, the property now pairs its shaded verandas and hand-cut terrazzo floors with a full wellness wing, two open-fire kitchens led by award-winning chefs, a rooftop observatory for the harmattan-clear night skies, and gardens that supply the restaurants with everything from lemongrass to sugarloaf pineapple.';
  const tourDesc =
    'Beginning with a sunrise crossing of the flood plains while the elephants are still moving between waterholes, the itinerary threads together village homestays with master weavers, a two-night canoe descent past hippo pools and fishing camps, guided walks through baobab groves with a field botanist, evenings of praise-singing and kora music around the fire, and a final ascent of the escarpment for a farewell breakfast looking back across everywhere you have been.';
  const specialReq =
    'Our party includes two vegetarian guests, one traveller who uses a lightweight folding wheelchair and can manage two or three steps with assistance, and my elderly mother who needs a ground-floor room close to the dining area; we would also be grateful for a late checkout on the final day because our return flight leaves close to midnight.';

  const LONG_NAMES = {
    address:
      'Plot 99441B, Avenue of the Distinguished Former Heads of State, Behind the Old Aerodrome Roundabout, Ministries District 47',
    airline: 'Trans-Continental Intercontinental Airways of West Africa', // 58
    city: 'Llanfairpwllgwyngyllgogerychwyrndrobwll-upon-Oti Municipality', // 61
    country:
      'The United Republic of the Northern Territories and Protectorates', // 66
    dest: 'Saint-Nicolas-de-la-Grave-upon-Volta International Heritage Riviera and Escarpment District', // 93
    hotel:
      'The Grand Presidential Continental Pan-African Resort, Conference Centre and Wellness Sanctuary', // 97
    room: 'Super-Executive Panoramic Presidential Penthouse Suite with Private Plunge Pool', // 80
    tour: 'The Complete Twelve-Region Grand Heritage, Wildlife, Culinary and Astronomical Expedition Platinum', // 101 -> trim
    user: 'Maximiliana-Anastasia Wolfeschlegelsteinhausenbergerdorff-Okonkwo-Abdulrahman-Vanderbilt III', // 93
  };
  const BIG = 9999999.99;

  for (const d of await prisma.destination.findMany()) {
    await prisma.destination.update({
      data: {
        city: LONG_NAMES.city,
        country: LONG_NAMES.country,
        description: destDesc,
        name: `${LONG_NAMES.dest} №${d.id}`,
      },
      where: { id: d.id },
    });
  }
  for (const h of await prisma.hotel.findMany()) {
    await prisma.hotel.update({
      data: {
        address: LONG_NAMES.address,
        amenities: [
          'high-speed fibre wifi throughout',
          '24-hour concierge and butler service',
          'rooftop infinity pool with swim-up bar',
          'full-service spa and hammam',
          'championship-standard tennis courts',
          'private cinema and screening room',
          'artisanal bakery and patisserie',
          'electric vehicle charging bays',
          'kids club with certified childminders',
          'on-call physician and wellness nurse',
        ],
        description: hotelDesc,
        name: `${LONG_NAMES.hotel} №${h.id}`,
      },
      where: { id: h.id },
    });
  }
  for (const r of await prisma.room.findMany()) {
    await prisma.room.update({
      data: {
        amenities: [
          'emperor-size four-poster bed',
          'private infinity plunge pool',
          'dedicated butler pantry',
          'panoramic wraparound balcony',
          'heated marble bathroom floors',
        ],
        description: hotelDesc,
        pricePerNight: BIG,
        roomType: `${LONG_NAMES.room} №${r.id}`,
      },
      where: { id: r.id },
    });
  }
  for (const f of await prisma.flight.findMany()) {
    await prisma.flight.update({
      data: {
        airline: LONG_NAMES.airline,
        duration: 1445,
        flightNumber: `TT-${9000 + f.id}-LH`,
        price: BIG,
        stops: 4,
      },
      where: { id: f.id },
    });
  }
  for (const t of await prisma.tour.findMany()) {
    await prisma.tour.update({
      data: {
        description: tourDesc,
        guestsBooked: 99999,
        maxGuests: 100000,
        name: `${LONG_NAMES.tour} №${t.id}`,
        price: BIG,
      },
      where: { id: t.id },
    });
  }
  const adminEmail = ENVIRONMENT_ADMIN();
  for (const u of await prisma.user.findMany()) {
    if (u.email === adminEmail) continue; // keep the login usable
    await prisma.user.update({
      data: {
        address: LONG_NAMES.address,
        email: `maximiliana.wolfeschlegelsteinhausenbergerdorff.okonkwo${u.id}@extremelylongdomainnameprovider-with-subsidiaries.example.com`,
        name: LONG_NAMES.user,
      },
      where: { id: u.id },
    });
  }
  for (const b of await prisma.booking.findMany()) {
    await prisma.booking.update({
      data: {
        numberOfGuests: 999,
        specialRequests: specialReq,
        totalPrice: BIG,
      },
      where: { id: b.id },
    });
  }
  for (const p of await prisma.payment.findMany()) {
    await prisma.payment.update({
      data: {
        amount: BIG,
        transactionReference: `TT-PAY-${p.id}-SETTLEMENT-2026-Q3-REF-99441B`,
      },
      where: { id: p.id },
    });
  }
  console.log('MAXIMIZED all rows to worst-case content');
}

/**
 * Worst-case content rows — max-length names, unbroken emails, huge amounts —
 * kept in the dev DB permanently so UI hardening stays testable.
 */
export async function worstCase() {
  const longDesc =
    'An impossibly detailed description that keeps going and going to stress every line-clamp, card height, and detail view: '.repeat(
      6,
    );
  const dest = await prisma.destination.create({
    data: {
      city: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch',
      country: 'The United Republic of Extraordinarily Long Country Names',
      description: longDesc,
      name: 'Saint-Nicolas-de-la-Grave-upon-Volta International Heritage Riviera & Grand Escarpment District',
    },
  });
  const hotel = await prisma.hotel.create({
    data: {
      address:
        'Plot 99441B, Avenue of the Extraordinarily Long Boulevard Names, Behind the Old Aerodrome Roundabout, District 47',
      amenities: Array.from({ length: 18 }, (_, i) => `amenity-${i + 1}`),
      description: longDesc,
      destinationId: dest.id,
      name: 'The Grand Presidential Continental Panafrican Resort, Conference Centre & Wellness Sanctuary of the Northern Savannah',
      starRating: 5,
    },
  });
  await prisma.room.create({
    data: {
      amenities: ['everything'],
      capacity: 12,
      hotelId: hotel.id,
      pricePerNight: 24493353.34,
      roomType:
        'Super-Executive Panoramic Presidential Penthouse Suite With Private Infinity Plunge Pool',
      totalRooms: 1,
    },
  });
  const day = 86400000,
    now2 = Date.now();
  const flight = await prisma.flight.create({
    data: {
      airline:
        'Trans-Continental Intercontinental Airways of West Africa, the Sahel & Beyond Ltd.',
      arrival: new Date(now2 + 31 * day),
      capacity: 2,
      departure: new Date(now2 + 30 * day),
      destinationId: dest.id === 1 ? 2 : 1,
      duration: 1445,
      flightClass: 'FIRST_CLASS',
      flightNumber: 'TT-99999-LHX',
      originId: dest.id,
      price: 24493353.34,
      seatsAvailable: 1,
      stops: 4,
    },
  });
  const tour = await prisma.tour.create({
    data: {
      description: longDesc,
      destinationId: dest.id,
      duration: 365,
      endDate: new Date(now2 + 405 * day),
      guestsBooked: 99999,
      maxGuests: 100000,
      name: 'The Complete Unabridged Twelve-Region Grand Heritage, Wildlife, Culinary & Astronomical Expedition of the Entire Subcontinent (Platinum Edition)',
      price: 24493353.34,
      startDate: new Date(now2 + 40 * day),
      type: 'ADVENTURE' as never,
    },
  });
  const password = await bcrypt.hash('Password123!', 10);
  const wcUser = await prisma.user.upsert({
    create: {
      email:
        'maximiliana.wolfeschlegelsteinhausenbergerdorff@extremelylongdomainnameprovider.example.com',
      name: 'Maximiliana-Anastasia Wolfeschlegelsteinhausenbergerdorff-Okonkwo-Abdulrahman III',
      password,
      phone: '233549999999',
      role: Role.CUSTOMER,
    },
    update: {},
    where: {
      email:
        'maximiliana.wolfeschlegelsteinhausenbergerdorff@extremelylongdomainnameprovider.example.com',
    },
  });
  const wb = await prisma.booking.create({
    data: {
      numberOfGuests: 42,
      status: BookingStatus.CONFIRMED,
      totalPrice: 24493353.34,
      tourId: tour.id,
      userId: wcUser.id,
    },
  });
  await prisma.payment.create({
    data: {
      amount: 24493353.34,
      bookingId: wb.id,
      paymentDate: new Date(),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.COMPLETED,
      transactionReference: 'TT-PAY-WORSTCASE-24493353',
      userId: wcUser.id,
    },
  });
  console.log(`SEEDED worst-case rows (flight ${flight.id})`);
}

function ENVIRONMENT_ADMIN() {
  return process.env.ADMIN_EMAIL ?? '';
}
