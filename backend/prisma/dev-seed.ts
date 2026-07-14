// Dev-only sample users, bookings, and payments for UI visualisation.
import prisma from '../src/config/prismaClient';
import { Role, BookingStatus, PaymentStatus, PaymentMethod } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

async function run() {
  const password = await bcrypt.hash('Password123!', 10);
  const usersData = [
    { name: 'Amina Fuseini', email: 'amina.fuseini@example.com', role: Role.CUSTOMER, phone: '233540000001', address: 'Osu, Accra' },
    { name: 'Kwabena Mensah', email: 'kwabena.mensah@example.com', role: Role.CUSTOMER, phone: '233540000002', address: 'Ahodwo, Kumasi' },
    { name: 'Efua Owusu-Ansah', email: 'efua.owusu@example.com', role: Role.CUSTOMER, phone: '233540000003' },
    { name: 'Yaw Darko', email: 'yaw.darko@example.com', role: Role.AGENT, phone: '233540000004', address: 'Airport City, Accra' },
    { name: 'Zeinab Alhassan', email: 'zeinab.alhassan@example.com', role: Role.AGENT, phone: '233540000005', address: 'Sagnarigu, Tamale' },
  ];
  const users = [];
  for (const u of usersData) {
    users.push(await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password },
    }));
  }
  console.log('users:', users.map(u => u.id).join(','));

  const [tourA, tourB] = await prisma.tour.findMany({ take: 2, orderBy: { id: 'asc' } });
  const [flightA, flightB] = await prisma.flight.findMany({ take: 2, orderBy: { id: 'asc' } });
  const rooms = await prisma.room.findMany({ take: 2, orderBy: { id: 'asc' } });
  const day = 86400000, now = Date.now();

  const mk = async (data: object) => prisma.booking.create({ data: data as never });

  const b1 = await mk({ userId: users[0].id, tourId: tourA.id, status: BookingStatus.CONFIRMED, numberOfGuests: 2, totalPrice: tourA.price * 2, bookingDate: new Date(now - 6 * day) });
  const b2 = await mk({ userId: users[1].id, tourId: tourB.id, status: BookingStatus.PENDING, numberOfGuests: 1, totalPrice: tourB.price, paymentDeadline: new Date(now + 2 * day), bookingDate: new Date(now - 1 * day) });
  const b3 = await mk({ userId: users[2].id, flightId: flightA.id, status: BookingStatus.CONFIRMED, numberOfGuests: 1, totalPrice: flightA.price, bookingDate: new Date(now - 3 * day) });
  const b4 = await mk({ userId: users[0].id, flightId: flightB.id, status: BookingStatus.CANCELLED, numberOfGuests: 1, totalPrice: flightB.price, bookingDate: new Date(now - 10 * day) });
  const b5 = await mk({ userId: users[1].id, roomId: rooms[0].id, status: BookingStatus.COMPLETED, numberOfGuests: 2, numberOfRooms: 1, numberOfNights: 3, startDate: new Date(now - 20 * day), endDate: new Date(now - 17 * day), totalPrice: rooms[0].pricePerNight * 3, bookingDate: new Date(now - 25 * day) });

  await prisma.payment.createMany({ data: [
    { bookingId: b1.id, userId: users[0].id, amount: b1.totalPrice, status: PaymentStatus.COMPLETED, paymentMethod: PaymentMethod.MOBILE_MONEY, paymentDate: new Date(now - 6 * day + 3600000), transactionReference: 'TT-PAY-0001' },
    { bookingId: b2.id, userId: users[1].id, amount: b2.totalPrice, status: PaymentStatus.PENDING, paymentMethod: PaymentMethod.MOBILE_MONEY, transactionReference: 'TT-PAY-0002' },
    { bookingId: b3.id, userId: users[2].id, amount: b3.totalPrice, status: PaymentStatus.COMPLETED, paymentMethod: PaymentMethod.CREDIT_CARD, paymentDate: new Date(now - 3 * day + 7200000), transactionReference: 'TT-PAY-0003' },
    { bookingId: b5.id, userId: users[1].id, amount: b5.totalPrice, status: PaymentStatus.REFUNDED, paymentMethod: PaymentMethod.BANK_TRANSFER, paymentDate: new Date(now - 24 * day), transactionReference: 'TT-PAY-0005' },
  ]});
  console.log('SEEDED bookings + payments');
}
// SEED_WORST_CASE=1 runs only the worst-case rows; default runs the base set.
const job = process.env.SEED_MAXIMIZE
  ? maximize()
  : process.env.SEED_WORST_CASE
    ? worstCase()
    : run();
job.catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

/**
 * Worst-case content rows — max-length names, unbroken emails, huge amounts —
 * kept in the dev DB permanently so UI hardening stays testable.
 */
export async function worstCase() {
  const longDesc = 'An impossibly detailed description that keeps going and going to stress every line-clamp, card height, and detail view: '.repeat(6);
  const dest = await prisma.destination.create({ data: {
    name: 'Saint-Nicolas-de-la-Grave-upon-Volta International Heritage Riviera & Grand Escarpment District',
    country: 'The United Republic of Extraordinarily Long Country Names',
    city: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch',
    description: longDesc,
  }});
  const hotel = await prisma.hotel.create({ data: {
    name: 'The Grand Presidential Continental Panafrican Resort, Conference Centre & Wellness Sanctuary of the Northern Savannah',
    address: 'Plot 99441B, Avenue of the Extraordinarily Long Boulevard Names, Behind the Old Aerodrome Roundabout, District 47',
    starRating: 5,
    amenities: Array.from({ length: 18 }, (_, i) => `amenity-${i + 1}`),
    destinationId: dest.id,
    description: longDesc,
  }});
  await prisma.room.create({ data: {
    hotelId: hotel.id, roomType: 'Super-Executive Panoramic Presidential Penthouse Suite With Private Infinity Plunge Pool',
    pricePerNight: 24493353.34, capacity: 12, totalRooms: 1, amenities: ['everything'],
  }});
  const day = 86400000, now2 = Date.now();
  const flight = await prisma.flight.create({ data: {
    flightNumber: 'TT-99999-LHX',
    airline: 'Trans-Continental Intercontinental Airways of West Africa, the Sahel & Beyond Ltd.',
    departure: new Date(now2 + 30 * day), arrival: new Date(now2 + 31 * day),
    originId: dest.id, destinationId: dest.id === 1 ? 2 : 1,
    price: 24493353.34, flightClass: 'FIRST_CLASS', duration: 1445, stops: 4, capacity: 2, seatsAvailable: 1,
  }});
  const tour = await prisma.tour.create({ data: {
    name: 'The Complete Unabridged Twelve-Region Grand Heritage, Wildlife, Culinary & Astronomical Expedition of the Entire Subcontinent (Platinum Edition)',
    type: 'ADVENTURE' as never, duration: 365, price: 24493353.34, maxGuests: 100000, guestsBooked: 99999,
    startDate: new Date(now2 + 40 * day), endDate: new Date(now2 + 405 * day),
    destinationId: dest.id, description: longDesc,
  }});
  const password = await bcrypt.hash('Password123!', 10);
  const wcUser = await prisma.user.upsert({
    where: { email: 'maximiliana.wolfeschlegelsteinhausenbergerdorff@extremelylongdomainnameprovider.example.com' },
    update: {},
    create: {
      name: 'Maximiliana-Anastasia Wolfeschlegelsteinhausenbergerdorff-Okonkwo-Abdulrahman III',
      email: 'maximiliana.wolfeschlegelsteinhausenbergerdorff@extremelylongdomainnameprovider.example.com',
      role: Role.CUSTOMER, phone: '233549999999', password,
    },
  });
  const wb = await prisma.booking.create({ data: {
    userId: wcUser.id, tourId: tour.id, status: BookingStatus.CONFIRMED,
    numberOfGuests: 42, totalPrice: 24493353.34,
  }});
  await prisma.payment.create({ data: {
    bookingId: wb.id, userId: wcUser.id, amount: 24493353.34,
    status: PaymentStatus.COMPLETED, paymentMethod: PaymentMethod.BANK_TRANSFER,
    paymentDate: new Date(), transactionReference: 'TT-PAY-WORSTCASE-24493353',
  }});
  console.log('SEEDED worst-case rows (flight ' + flight.id + ')');
}

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
    dest: 'Saint-Nicolas-de-la-Grave-upon-Volta International Heritage Riviera and Escarpment District', // 93
    country: 'The United Republic of the Northern Territories and Protectorates', // 66
    city: 'Llanfairpwllgwyngyllgogerychwyrndrobwll-upon-Oti Municipality', // 61
    hotel: 'The Grand Presidential Continental Pan-African Resort, Conference Centre and Wellness Sanctuary', // 97
    address: 'Plot 99441B, Avenue of the Distinguished Former Heads of State, Behind the Old Aerodrome Roundabout, Ministries District 47',
    room: 'Super-Executive Panoramic Presidential Penthouse Suite with Private Plunge Pool', // 80
    airline: 'Trans-Continental Intercontinental Airways of West Africa', // 58
    tour: 'The Complete Twelve-Region Grand Heritage, Wildlife, Culinary and Astronomical Expedition Platinum', // 101 -> trim
    user: 'Maximiliana-Anastasia Wolfeschlegelsteinhausenbergerdorff-Okonkwo-Abdulrahman-Vanderbilt III', // 93
  };
  const BIG = 9999999.99;

  for (const d of await prisma.destination.findMany()) {
    await prisma.destination.update({ where: { id: d.id }, data: {
      name: `${LONG_NAMES.dest} №${d.id}`,
      country: LONG_NAMES.country,
      city: LONG_NAMES.city,
      description: destDesc,
    }});
  }
  for (const h of await prisma.hotel.findMany()) {
    await prisma.hotel.update({ where: { id: h.id }, data: {
      name: `${LONG_NAMES.hotel} №${h.id}`,
      address: LONG_NAMES.address,
      description: hotelDesc,
      amenities: ['high-speed fibre wifi throughout','24-hour concierge and butler service','rooftop infinity pool with swim-up bar','full-service spa and hammam','championship-standard tennis courts','private cinema and screening room','artisanal bakery and patisserie','electric vehicle charging bays','kids club with certified childminders','on-call physician and wellness nurse'],
    }});
  }
  for (const r of await prisma.room.findMany()) {
    await prisma.room.update({ where: { id: r.id }, data: {
      roomType: `${LONG_NAMES.room} №${r.id}`,
      pricePerNight: BIG,
      description: hotelDesc,
      amenities: ['emperor-size four-poster bed','private infinity plunge pool','dedicated butler pantry','panoramic wraparound balcony','heated marble bathroom floors'],
    }});
  }
  for (const f of await prisma.flight.findMany()) {
    await prisma.flight.update({ where: { id: f.id }, data: {
      airline: LONG_NAMES.airline,
      flightNumber: `TT-${9000 + f.id}-LH`,
      price: BIG,
      duration: 1445,
      stops: 4,
    }});
  }
  for (const t of await prisma.tour.findMany()) {
    await prisma.tour.update({ where: { id: t.id }, data: {
      name: `${LONG_NAMES.tour} №${t.id}`,
      description: tourDesc,
      price: BIG,
      maxGuests: 100000,
      guestsBooked: 99999,
    }});
  }
  const adminEmail = ENVIRONMENT_ADMIN();
  for (const u of await prisma.user.findMany()) {
    if (u.email === adminEmail) continue; // keep the login usable
    await prisma.user.update({ where: { id: u.id }, data: {
      name: LONG_NAMES.user,
      email: `maximiliana.wolfeschlegelsteinhausenbergerdorff.okonkwo${u.id}@extremelylongdomainnameprovider-with-subsidiaries.example.com`,
      address: LONG_NAMES.address,
    }});
  }
  for (const b of await prisma.booking.findMany()) {
    await prisma.booking.update({ where: { id: b.id }, data: {
      totalPrice: BIG,
      numberOfGuests: 999,
      specialRequests: specialReq,
    }});
  }
  for (const p of await prisma.payment.findMany()) {
    await prisma.payment.update({ where: { id: p.id }, data: {
      amount: BIG,
      transactionReference: `TT-PAY-${p.id}-SETTLEMENT-2026-Q3-REF-99441B`,
    }});
  }
  console.log('MAXIMIZED all rows to worst-case content');
}

function ENVIRONMENT_ADMIN() {
  return process.env.ADMIN_EMAIL || '';
}
