import * as bcrypt from 'bcrypt';
import crypto from 'node:crypto';

import ENV from '#config/env.js';
import prisma from '#config/prismaClient.js';
import logger from '#utils/logger.js';

// prisma/seed.ts
//
// Seed, gated by two env flags so running `npm run seed` is always safe:
//   ADMIN_SEED_ENABLED       — false (default) makes the seed a logged no-op.
//   ADMIN_SEED_FORCE_UPDATE  — false (default) makes it CREATE-ONLY: an
//                              existing row is never overwritten. Set true
//                              to push the current values onto an existing
//                              row (credential rotation).
//
// It creates the operator ADMIN (from ADMIN_* env) plus the two remaining
// demo principals (a staff AGENT and a CUSTOMER) so the credential-free
// POST /auth/demo-login works for all three roles out of the box: the demo
// AGENT/CUSTOMER rows use the very emails demo-login resolves
// (ENV.DEMO_AGENT_EMAIL / ENV.DEMO_CUSTOMER_EMAIL, which default to fixed
// seed-owned addresses in src/config/env.ts). Point DEMO_ADMIN_EMAIL at
// ADMIN_EMAIL to wire up the demo ADMIN as well.
import {
  BookingStatus,
  FlightStatus,
  PaymentMethod,
  PaymentStatus,
  ReviewStatus,
  Role,
  TourStatus,
  TourType,
} from '../generated/prisma/client.js';

/** A fresh random password for each seeded demo account. demo-login never
 * checks it (it resolves the account and mints a session directly), so the
 * demo still works with no credential in the client; making it random and
 * unknown means the normal login form CANNOT be used to reach a demo account,
 * which would otherwise be a public-credentials backdoor into a staff role. */
const randomDemoPassword = (): Promise<string> =>
  bcrypt.hash(crypto.randomBytes(24).toString('hex'), SALT_ROUNDS);
const DEMO_AGENT_NAME = 'Demo Agent';
const DEMO_CUSTOMER_NAME = 'Demo Customer';

/** bcrypt cost matches the admin hash below and BCRYPT_SALT_ROUNDS. */
const SALT_ROUNDS = 10;

async function main() {
  if (!ENV.ADMIN_SEED_ENABLED) {
    logger.info('Seed skipped (ADMIN_SEED_ENABLED is not true).');
    return;
  }

  // Order is independent (distinct emails/tables); admin first keeps the log
  // reading operator-account-then-demo-principals.
  await seedAdmin();
  await seedDemoAgent();
  await seedDemoCustomer();
  await seedCatalogAndBookings();
}

async function seedAdmin() {
  // ADMIN_* are optional in the app ENV (production never needs them) —
  // the seed is their only reader, so it fails fast here instead.
  const adminEmail = ENV.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = ENV.ADMIN_PASSWORD;
  const adminName = ENV.ADMIN_NAME;
  const adminPhone = ENV.ADMIN_PHONE;

  if (!adminEmail || !adminPassword || !adminName || !adminPhone) {
    logger.error(
      'Admin seed: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME and ADMIN_PHONE must all be set to run the seed.',
    );
    process.exit(1);
  }

  // Resolve the row this seed owns by email OR phone — both are unique
  // login identifiers, so rotating ADMIN_EMAIL while keeping the phone (or
  // vice versa) updates the same admin row instead of dying on the other
  // field's unique constraint. findUnique on purpose (unscoped): a
  // soft-deleted row still holds its contacts.
  const [byEmail, byPhone] = await Promise.all([
    prisma.user.findUnique({
      select: { email: true, id: true, phone: true },
      where: { email: adminEmail },
    }),
    prisma.user.findUnique({
      select: { email: true, id: true, phone: true },
      where: { phone: adminPhone },
    }),
  ]);

  if (byEmail && byPhone && byEmail.id !== byPhone.id) {
    logger.error(
      `Admin seed: ADMIN_EMAIL belongs to user ${String(byEmail.id)} but ` +
        `ADMIN_PHONE belongs to user ${String(byPhone.id)} — ambiguous ` +
        `target. Change one of them (or free the contact in the app) and rerun.`,
    );
    process.exit(1);
  }

  const existing = byEmail ?? byPhone;

  // The customer/staff split keeps contacts unique ACROSS both tables
  // (login resolves customer-first) — never seed a staff admin onto a
  // contact a customer holds.
  const [customerByEmail, customerByPhone] = await Promise.all([
    prisma.customer.findUnique({
      select: { id: true },
      where: { email: adminEmail },
    }),
    prisma.customer.findUnique({
      select: { id: true },
      where: { phone: adminPhone },
    }),
  ]);
  if (customerByEmail || customerByPhone) {
    logger.error(
      'Admin seed: the admin email/phone is already held by a CUSTOMER ' +
        'account — seeding staff onto it would shadow that login. Use a ' +
        'different contact.',
    );
    process.exit(1);
  }

  if (existing && !ENV.ADMIN_SEED_FORCE_UPDATE) {
    logger.info(
      `Admin seed: admin already exists as ${existing.email ?? existing.phone ?? String(existing.id)} — ` +
        `no changes (ADMIN_SEED_FORCE_UPDATE is not true).`,
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  const admin = existing
    ? await prisma.user.update({
        data: {
          email: adminEmail,
          name: adminName,
          password: hashedPassword,
          phone: adminPhone,
          role: Role.ADMIN,
          // Credential rotation invalidates every live session, exactly
          // like an in-app password change (session-epoch bump).
          tokenVersion: { increment: 1 },
        },
        where: { id: existing.id },
      })
    : await prisma.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          password: hashedPassword,
          phone: adminPhone,
          role: Role.ADMIN,
        },
      });

  logger.info({
    admin: {
      email: admin.email,
      id: admin.id,
      name: admin.name,
      role: admin.role,
    },
    message: existing
      ? 'Admin user updated (ADMIN_SEED_FORCE_UPDATE=true)'
      : 'Admin user created',
  });
}

// ---------------------------------------------------------------------------
// Rich, idempotent, time-anchored catalog + bookings.
//
// Runs after the principals on every `npm run seed`. It owns a fixed set of
// destinations, hotels, rooms, tours, flights and demo customers (matched by
// name / flight number / email), refreshes their dates relative to NOW so the
// catalog always shows current UPCOMING/ONGOING tours and SCHEDULED flights,
// and clears + regenerates the demo customers' bookings/payments/reviews. Run
// it again in a month and the whole window slides forward, so a visitor always
// sees a live, populated site. Real customer data is left untouched.
// ---------------------------------------------------------------------------
async function seedCatalogAndBookings(): Promise<void> {
  const now = new Date();
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const daysFromNow = (d: number): Date => new Date(now.getTime() + d * DAY);
  const hoursFromNow = (h: number): Date => new Date(now.getTime() + h * HOUR);
  const rand = (min: number, max: number): number =>
    min + Math.random() * (max - min);
  const randInt = (min: number, max: number): number =>
    Math.floor(rand(min, max + 1));
  const pick = <T>(arr: readonly T[]): T => arr[randInt(0, arr.length - 1)];
  const chance = (p: number): boolean => Math.random() < p;
  const shuffle = <T>(arr: readonly T[]): T[] =>
    [...arr].sort(() => Math.random() - 0.5);
  const ref = (): string =>
    `TT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  // Resolve a required lookup (a destination id we just seeded) without a
  // forbidden non-null assertion.
  const must = <T>(value: T | undefined): T => {
    if (value === undefined) throw new Error('Missing seeded reference');
    return value;
  };
  const demoPassword = await randomDemoPassword();

  // Free, hot-linkable stock images (Unsplash CDN) so the catalog looks real.
  const IMG = {
    adventure: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    city: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&q=80',
    cruise: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=800&q=80',
    cultural: 'https://images.unsplash.com/photo-1539768942893-daf53e448371?auto=format&fit=crop&w=800&q=80',
    flight: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80',
    hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    room: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80',
    safari: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=800&q=80',
  };
  const TOUR_TYPE_PHOTO: Record<TourType, string> = {
    [TourType.ADVENTURE]: IMG.adventure,
    [TourType.BEACH]: IMG.beach,
    [TourType.CITY]: IMG.city,
    [TourType.CRUISE]: IMG.cruise,
    [TourType.CULTURAL]: IMG.cultural,
    [TourType.WILDLIFE]: IMG.safari,
  };
  const DEST_PHOTO: Record<string, string> = {
    Accra: IMG.city,
    Cairo: IMG.cultural,
    'Cape Coast': IMG.beach,
    'Cape Town': IMG.adventure,
    Marrakech: IMG.city,
    Santorini: IMG.cruise,
    Serengeti: IMG.safari,
    Zanzibar: IMG.beach,
  };

  // --- customers (upsert by email; no phone, so re-runs never clash) ---
  const CUSTOMER_NAMES = [
    'Ama Mensah', 'Kofi Boateng', 'Yaa Asante', 'Kwame Owusu', 'Abena Sarpong',
    'Kojo Danso', 'Esi Bediako', 'Yaw Ofori', 'Adwoa Frimpong', 'Fiifi Quaye',
    'Akosua Addai', 'Kwesi Appiah', 'Efua Nyarko', 'Nana Acheampong', 'Maya Osei',
    'Sena Agyeman', 'Elorm Kudjo', 'Dela Ansah', 'Selorm Tetteh', 'Mawuli Doe',
    'Afia Owusu', 'Nii Lartey', 'Adjoa Boakye', 'Kojo Amankwah', 'Ama Serwaa',
    'Kwabena Osei', 'Akua Darko', 'Yaw Antwi', 'Efua Baah', 'Kofi Asante',
  ];
  const customerIds: number[] = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i += 1) {
    const email = `customer${i + 1}@demo.traveltrek.app`;
    const customer = await prisma.customer.upsert({
      create: { email, name: CUSTOMER_NAMES[i], password: demoPassword },
      select: { id: true },
      update: { name: CUSTOMER_NAMES[i] },
      where: { email },
    });
    customerIds.push(customer.id);
  }
  // Include the demo-login customer so its "my bookings" is populated too.
  const demoCustomer = await prisma.customer.findUnique({
    select: { id: true },
    where: { email: ENV.DEMO_CUSTOMER_EMAIL },
  });
  if (demoCustomer) customerIds.push(demoCustomer.id);

  // --- destinations (find-or-create by name) ---
  const DESTINATIONS = [
    { city: 'Cape Coast', country: 'Ghana', description: 'Historic castles and golden Atlantic beaches.', name: 'Cape Coast' },
    { city: 'Accra', country: 'Ghana', description: "Ghana's vibrant seaside capital.", name: 'Accra' },
    { city: 'Zanzibar City', country: 'Tanzania', description: 'Spice islands and turquoise water.', name: 'Zanzibar' },
    { city: 'Arusha', country: 'Tanzania', description: 'Endless plains and the great migration.', name: 'Serengeti' },
    { city: 'Cairo', country: 'Egypt', description: 'Pyramids, the Nile and ancient wonders.', name: 'Cairo' },
    { city: 'Cape Town', country: 'South Africa', description: 'Table Mountain, beaches and winelands.', name: 'Cape Town' },
    { city: 'Marrakech', country: 'Morocco', description: 'Medinas, souks and desert gateways.', name: 'Marrakech' },
    { city: 'Thira', country: 'Greece', description: 'Caldera views and whitewashed villages.', name: 'Santorini' },
  ];
  const destId = new Map<string, number>();
  for (const d of DESTINATIONS) {
    const data = { ...d, photo: DEST_PHOTO[d.name] };
    const existing = await prisma.destination.findFirst({
      select: { id: true },
      where: { name: d.name },
    });
    const row = existing
      ? await prisma.destination.update({ data, select: { id: true }, where: { id: existing.id } })
      : await prisma.destination.create({ data, select: { id: true } });
    destId.set(d.name, row.id);
  }

  // --- hotels + rooms (find-or-create by name / hotel+roomType) ---
  const HOTELS = [
    { amenities: ['Pool', 'Beach access', 'Restaurant', 'Free WiFi'], dest: 'Cape Coast', name: 'Elmina Bay Resort', starRating: 4 },
    { amenities: ['Pool', 'Spa', 'Gym', 'Restaurant', 'Free WiFi'], dest: 'Accra', name: 'Accra Marina Hotel', starRating: 5 },
    { amenities: ['Beachfront', 'Pool', 'Spa', 'Diving'], dest: 'Zanzibar', name: 'Zanzibar Pearl', starRating: 5 },
    { amenities: ['Game drives', 'Restaurant', 'Bar'], dest: 'Serengeti', name: 'Serengeti Safari Lodge', starRating: 4 },
    { amenities: ['Nile view', 'Pool', 'Restaurant'], dest: 'Cairo', name: 'Nile View Cairo', starRating: 4 },
    { amenities: ['Mountain view', 'Spa', 'Gym', 'Wine cellar'], dest: 'Cape Town', name: 'Table Mountain Suites', starRating: 5 },
    { amenities: ['Rooftop', 'Hammam', 'Courtyard'], dest: 'Marrakech', name: 'Riad Marrakech', starRating: 4 },
    { amenities: ['Caldera view', 'Infinity pool', 'Sunset terrace'], dest: 'Santorini', name: 'Caldera Santorini', starRating: 5 },
  ];
  const ROOM_TEMPLATES = [
    { capacity: 2, price: 45_000, roomType: 'Standard', totalRooms: 20 },
    { capacity: 3, price: 85_000, roomType: 'Deluxe', totalRooms: 12 },
    { capacity: 4, price: 160_000, roomType: 'Suite', totalRooms: 6 },
  ];
  const rooms: { capacity: number; id: number; price: number; }[] = [];
  for (const h of HOTELS) {
    const destinationId = must(destId.get(h.dest));
    const hotelData = {
      address: `${h.name}, ${h.dest}`,
      amenities: h.amenities,
      description: `A ${h.starRating.toString()}-star stay in ${h.dest}.`,
      destinationId,
      name: h.name,
      phone: '+233555000000',
      photo: IMG.hotel,
      starRating: h.starRating,
    };
    const existingHotel = await prisma.hotel.findFirst({ select: { id: true }, where: { name: h.name } });
    const hotel = existingHotel
      ? await prisma.hotel.update({ data: hotelData, select: { id: true }, where: { id: existingHotel.id } })
      : await prisma.hotel.create({ data: hotelData, select: { id: true } });

    for (const rt of ROOM_TEMPLATES) {
      const price = Math.round((rt.price * h.starRating) / 4);
      const roomData = {
        amenities: ['Air conditioning', 'TV', 'Free WiFi'],
        capacity: rt.capacity,
        description: `${rt.roomType} room at ${h.name}.`,
        hotelId: hotel.id,
        photo: IMG.room,
        pricePerNight: price,
        roomType: rt.roomType,
        totalRooms: rt.totalRooms,
      };
      const existingRoom = await prisma.room.findFirst({
        select: { id: true },
        where: { hotelId: hotel.id, roomType: rt.roomType },
      });
      const room = existingRoom
        ? await prisma.room.update({ data: roomData, select: { id: true }, where: { id: existingRoom.id } })
        : await prisma.room.create({ data: roomData, select: { id: true } });
      rooms.push({ capacity: rt.capacity, id: room.id, price });
    }
  }

  // --- tours (find-or-create by name; time-anchored so status is live) ---
  const TOUR_CONFIGS: {
    cancelled?: boolean;
    dest: string;
    duration: number;
    maxGuests: number;
    name: string;
    price: number;
    startOffset: number;
    type: TourType;
  }[] = [
    { dest: 'Cape Coast', duration: 3, maxGuests: 20, name: 'Cape Coast Castle Heritage Walk', price: 180_000, startOffset: -35, type: TourType.CULTURAL },
    { dest: 'Serengeti', duration: 6, maxGuests: 12, name: 'Serengeti Migration Safari', price: 650_000, startOffset: -20, type: TourType.WILDLIFE },
    { dest: 'Accra', duration: 2, maxGuests: 25, name: 'Accra City & Nightlife', price: 120_000, startOffset: -10, type: TourType.CITY },
    { dest: 'Cairo', duration: 4, maxGuests: 18, name: 'Pyramids of Giza Expedition', price: 420_000, startOffset: -6, type: TourType.CULTURAL },
    { dest: 'Zanzibar', duration: 5, maxGuests: 16, name: 'Zanzibar Beach Escape', price: 480_000, startOffset: -2, type: TourType.BEACH },
    { dest: 'Cape Town', duration: 5, maxGuests: 20, name: 'Cape Town & Winelands', price: 540_000, startOffset: -1, type: TourType.CITY },
    { dest: 'Cape Town', duration: 3, maxGuests: 15, name: 'Table Mountain Adventure', price: 260_000, startOffset: 6, type: TourType.ADVENTURE },
    { dest: 'Marrakech', duration: 4, maxGuests: 18, name: 'Marrakech Desert & Medina', price: 380_000, startOffset: 12, type: TourType.ADVENTURE },
    { dest: 'Santorini', duration: 4, maxGuests: 24, name: 'Santorini Sunset Cruise', price: 720_000, startOffset: 20, type: TourType.CRUISE },
    { dest: 'Cape Coast', duration: 3, maxGuests: 22, name: 'Elmina Beach Getaway', price: 210_000, startOffset: 30, type: TourType.BEACH },
    { dest: 'Cairo', duration: 7, maxGuests: 30, name: 'Nile Cultural Cruise', price: 890_000, startOffset: 45, type: TourType.CRUISE },
    { dest: 'Serengeti', duration: 5, maxGuests: 12, name: 'Serengeti Balloon & Wildlife', price: 760_000, startOffset: 60, type: TourType.WILDLIFE },
    { cancelled: true, dest: 'Zanzibar', duration: 4, maxGuests: 16, name: 'Zanzibar Spice & Reef', price: 430_000, startOffset: 15, type: TourType.BEACH },
    { dest: 'Accra', duration: 2, maxGuests: 20, name: 'Accra Food & Culture Trail', price: 140_000, startOffset: -50, type: TourType.CULTURAL },
  ];
  const tours: { id: number; maxGuests: number; price: number; startDate: Date; status: TourStatus }[] = [];
  for (const t of TOUR_CONFIGS) {
    const startDate = daysFromNow(t.startOffset);
    const endDate = daysFromNow(t.startOffset + t.duration);
    const status = t.cancelled
      ? TourStatus.CANCELLED
      : endDate < now
        ? TourStatus.COMPLETED
        : startDate <= now
          ? TourStatus.ONGOING
          : TourStatus.UPCOMING;
    const data = {
      description: `${t.name} - a ${t.duration.toString()}-day ${t.type.toLowerCase()} experience.`,
      destinationId: must(destId.get(t.dest)),
      duration: t.duration,
      endDate,
      maxGuests: t.maxGuests,
      name: t.name,
      photo: TOUR_TYPE_PHOTO[t.type],
      price: t.price,
      startDate,
      status,
      type: t.type,
    };
    const existing = await prisma.tour.findFirst({ select: { id: true }, where: { name: t.name } });
    const row = existing
      ? await prisma.tour.update({ data, select: { id: true }, where: { id: existing.id } })
      : await prisma.tour.create({ data, select: { id: true } });
    tours.push({ id: row.id, maxGuests: t.maxGuests, price: t.price, startDate, status });
  }

  // --- flights (upsert by flightNumber; time-anchored) ---
  const FLIGHT_CONFIGS: {
    airline: string;
    capacity: number;
    departOffset: number;
    dest: string;
    duration: number;
    flightClass: string;
    flightNumber: string;
    forced?: FlightStatus;
    origin: string;
    price: number;
    stops: number;
  }[] = [
    { airline: 'TravelTrek Air', capacity: 180, departOffset: 30, dest: 'Cairo', duration: 360, flightClass: 'Economy', flightNumber: 'TT101', origin: 'Accra', price: 520_000, stops: 0 },
    { airline: 'TravelTrek Air', capacity: 180, departOffset: 54, dest: 'Cape Town', duration: 390, flightClass: 'Economy', flightNumber: 'TT102', origin: 'Accra', price: 610_000, stops: 1 },
    { airline: 'Sky Ghana', capacity: 40, departOffset: 96, dest: 'Zanzibar', duration: 420, flightClass: 'Business', flightNumber: 'TT103', origin: 'Accra', price: 700_000, stops: 1 },
    { airline: 'TravelTrek Air', capacity: 90, departOffset: 6, dest: 'Accra', duration: 55, flightClass: 'Economy', flightNumber: 'TT104', origin: 'Cape Coast', price: 90_000, stops: 0 },
    { airline: 'Sahara Wings', capacity: 160, departOffset: 120, dest: 'Marrakech', duration: 300, flightClass: 'Economy', flightNumber: 'TT105', origin: 'Cairo', price: 340_000, stops: 0 },
    { airline: 'Aegean Blue', capacity: 150, departOffset: 200, dest: 'Santorini', duration: 150, flightClass: 'Economy', flightNumber: 'TT106', origin: 'Cairo', price: 410_000, stops: 0 },
    { airline: 'TravelTrek Air', capacity: 160, departOffset: -3, dest: 'Serengeti', duration: 400, flightClass: 'Economy', flightNumber: 'TT107', origin: 'Accra', price: 660_000, stops: 1 },
    { airline: 'Sky Ghana', capacity: 180, departOffset: -30, dest: 'Accra', duration: 390, flightClass: 'Economy', flightNumber: 'TT108', origin: 'Cape Town', price: 600_000, stops: 1 },
    { airline: 'Sahara Wings', capacity: 160, departOffset: 12, dest: 'Accra', duration: 330, flightClass: 'Economy', flightNumber: 'TT109', forced: FlightStatus.DELAYED, origin: 'Marrakech', price: 480_000, stops: 1 },
    { airline: 'Aegean Blue', capacity: 40, departOffset: 72, dest: 'Cairo', duration: 150, flightClass: 'Business', flightNumber: 'TT110', forced: FlightStatus.CANCELLED, origin: 'Santorini', price: 400_000, stops: 0 },
  ];
  const flights: { capacity: number; id: number; price: number; }[] = [];
  for (const f of FLIGHT_CONFIGS) {
    const departure = hoursFromNow(f.departOffset);
    const arrival = new Date(departure.getTime() + f.duration * 60_000);
    const status =
      f.forced ??
      (departure > now
        ? FlightStatus.SCHEDULED
        : now < arrival
          ? FlightStatus.DEPARTED
          : FlightStatus.LANDED);
    const data = {
      airline: f.airline,
      arrival,
      capacity: f.capacity,
      departure,
      destinationId: must(destId.get(f.dest)),
      duration: f.duration,
      flightClass: f.flightClass,
      originId: must(destId.get(f.origin)),
      photo: IMG.flight,
      price: f.price,
      seatsAvailable: f.capacity,
      status,
      stops: f.stops,
    };
    const row = await prisma.flight.upsert({
      create: { flightNumber: f.flightNumber, ...data },
      select: { id: true },
      update: data,
      where: { flightNumber: f.flightNumber },
    });
    flights.push({ capacity: f.capacity, id: row.id, price: f.price });
  }

  // --- clear this seed's transactional data (scoped to demo customers) ---
  // Order respects the FK Restrict chain: reviews/payments reference bookings.
  // deleteMany hard-deletes here (the soft-delete extension only scopes reads).
  await prisma.review.deleteMany({ where: { customerId: { in: customerIds } } });
  await prisma.payment.deleteMany({ where: { customerId: { in: customerIds } } });
  await prisma.booking.deleteMany({ where: { customerId: { in: customerIds } } });

  // --- regenerate bookings + payments + reviews ---
  const demoAgent = await prisma.user.findUnique({
    select: { id: true },
    where: { email: ENV.DEMO_AGENT_EMAIL },
  });
  const agentId: null | number = demoAgent?.id ?? null;

  const REVIEW_TITLES = ['Unforgettable trip', 'Great value', 'Highly recommend', 'Amazing experience', 'Would book again', 'Trip of a lifetime'];
  const REVIEW_COMMENTS = [
    'Everything was well organised and the guides were fantastic.',
    'Beautiful destination and smooth booking - thank you TravelTrek!',
    'A few small hiccups but overall a wonderful experience.',
    'Exceeded our expectations. The team took care of every detail.',
    'Good trip, though I wish it had been a day longer.',
  ];
  const METHODS = [PaymentMethod.CREDIT_CARD, PaymentMethod.MOBILE_MONEY, PaymentMethod.DEBIT_CARD, PaymentMethod.BANK_TRANSFER];

  const tourGuests = new Map<number, number>();
  const flightSeats = new Map<number, number>();
  let bookingCount = 0;
  let reviewCount = 0;

  const createPayment = async (
    bookingId: number,
    customerId: number,
    amount: number,
    bookingStatus: BookingStatus,
    when: Date,
  ): Promise<void> => {
    let status: PaymentStatus;
    let paymentDate: Date | null;
    if (bookingStatus === BookingStatus.COMPLETED || bookingStatus === BookingStatus.CONFIRMED) {
      status = PaymentStatus.COMPLETED;
      paymentDate = when;
    } else if (bookingStatus === BookingStatus.PENDING) {
      status = chance(0.25) ? PaymentStatus.FAILED : PaymentStatus.PENDING;
      paymentDate = null;
    } else {
      const roll = Math.random();
      status = roll < 0.5 ? PaymentStatus.REFUNDED : roll < 0.75 ? PaymentStatus.REFUND_REQUESTED : PaymentStatus.FAILED;
      paymentDate = status === PaymentStatus.FAILED ? null : when;
    }
    await prisma.payment.create({
      data: {
        amount,
        bookingId,
        createdAt: when,
        currency: 'GHS',
        customerId,
        paymentDate,
        paymentMethod: pick(METHODS),
        status,
        transactionReference: ref(),
      },
    });
  };

  const maybeReview = async (bookingId: number, customerId: number): Promise<void> => {
    if (!chance(0.7)) return;
    const rating = chance(0.75) ? randInt(4, 5) : randInt(1, 3);
    await prisma.review.create({
      data: {
        bookingId,
        comment: pick(REVIEW_COMMENTS),
        customerId,
        rating,
        status: chance(0.9) ? ReviewStatus.PUBLISHED : ReviewStatus.HIDDEN,
        title: pick(REVIEW_TITLES),
      },
    });
    reviewCount += 1;
  };

  // Per-customer uniqueness guards for the booking constraints.
  const usedTour = new Set<string>();
  const usedFlight = new Set<string>();

  // Booking status follows how long ago it was made: older bookings have run
  // their course, recent ones are still confirmed/pending. This spreads
  // COMPLETED-payment revenue across every month while keeping "this week"
  // full of live, in-flight bookings.
  const statusForAge = (when: Date): BookingStatus => {
    const ageDays = (now.getTime() - when.getTime()) / DAY;
    if (ageDays > 45) {
      return chance(0.82) ? BookingStatus.COMPLETED : BookingStatus.CANCELLED;
    }
    if (ageDays > 7) {
      const roll = Math.random();
      return roll < 0.55
        ? BookingStatus.CONFIRMED
        : roll < 0.8
          ? BookingStatus.COMPLETED
          : BookingStatus.CANCELLED;
    }
    return chance(0.5)
      ? BookingStatus.CONFIRMED
      : chance(0.75)
        ? BookingStatus.PENDING
        : BookingStatus.CANCELLED;
  };

  const finish = async (
    bookingId: number,
    customerId: number,
    totalPrice: number,
    status: BookingStatus,
    when: Date,
  ): Promise<void> => {
    bookingCount += 1;
    await createPayment(bookingId, customerId, totalPrice, status, when);
    if (status === BookingStatus.COMPLETED) await maybeReview(bookingId, customerId);
  };

  const bookTour = async (customerId: number, when: Date): Promise<boolean> => {
    const key = (id: number): string => `${customerId.toString()}:${id.toString()}`;
    const t = shuffle(tours).find((tour) => !usedTour.has(key(tour.id)));
    if (!t) return false;
    usedTour.add(key(t.id));
    const guests = randInt(1, 4);
    const status =
      t.status === TourStatus.CANCELLED ? BookingStatus.CANCELLED : statusForAge(when);
    const totalPrice = t.price * guests;
    const booking = await prisma.booking.create({
      data: {
        bookingDate: when,
        createdAt: when,
        createdByUserId: chance(0.3) ? agentId : null,
        customerId,
        numberOfGuests: guests,
        status,
        totalPrice,
        tourId: t.id,
      },
      select: { id: true },
    });
    if (status !== BookingStatus.CANCELLED) {
      tourGuests.set(t.id, (tourGuests.get(t.id) ?? 0) + guests);
    }
    await finish(booking.id, customerId, totalPrice, status, when);
    return true;
  };

  const bookRoom = async (customerId: number, when: Date): Promise<void> => {
    const room = pick(rooms);
    const nights = randInt(2, 7);
    const numberOfRooms = randInt(1, 2);
    const startDate = new Date(when.getTime() + randInt(3, 45) * DAY);
    const endDate = new Date(startDate.getTime() + nights * DAY);
    const status = statusForAge(when);
    const totalPrice = room.price * nights * numberOfRooms;
    const booking = await prisma.booking.create({
      data: {
        bookingDate: when,
        createdAt: when,
        createdByUserId: chance(0.3) ? agentId : null,
        customerId,
        endDate,
        numberOfGuests: randInt(1, room.capacity),
        numberOfNights: nights,
        numberOfRooms,
        roomId: room.id,
        startDate,
        status,
        totalPrice,
      },
      select: { id: true },
    });
    await finish(booking.id, customerId, totalPrice, status, when);
  };

  const bookFlight = async (customerId: number, when: Date): Promise<boolean> => {
    const key = (id: number): string => `${customerId.toString()}:${id.toString()}`;
    const f = shuffle(flights).find((flight) => !usedFlight.has(key(flight.id)));
    if (!f) return false;
    usedFlight.add(key(f.id));
    const guests = randInt(1, 3);
    const status = statusForAge(when);
    const totalPrice = f.price * guests;
    const booking = await prisma.booking.create({
      data: {
        bookingDate: when,
        createdAt: when,
        createdByUserId: chance(0.3) ? agentId : null,
        customerId,
        flightId: f.id,
        numberOfGuests: guests,
        status,
        totalPrice,
      },
      select: { id: true },
    });
    if (status === BookingStatus.CONFIRMED || status === BookingStatus.COMPLETED) {
      flightSeats.set(f.id, (flightSeats.get(f.id) ?? 0) + guests);
    }
    await finish(booking.id, customerId, totalPrice, status, when);
    return true;
  };

  // Booking dates across the current year (plus December of last year for the
  // previous-window trend), weighted toward the current month and the last 7
  // days - so this-week / this-month / last-month / this-year charts all carry
  // data and the year view runs across every month.
  const bookingDates: Date[] = [];
  const addDate = (d: Date): void => {
    if (d <= now) bookingDates.push(d);
  };
  let month = new Date(now.getFullYear() - 1, 11, 1);
  while (month <= now) {
    const isCurrent =
      month.getFullYear() === now.getFullYear() &&
      month.getMonth() === now.getMonth();
    const perMonth = isCurrent ? 20 : 11;
    const lastDay = isCurrent
      ? Math.max(1, now.getDate())
      : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let i = 0; i < perMonth; i += 1) {
      addDate(
        new Date(
          month.getFullYear(),
          month.getMonth(),
          randInt(1, lastDay),
          randInt(8, 20),
          randInt(0, 59),
        ),
      );
    }
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  }
  for (let i = 0; i < 14; i += 1) {
    addDate(new Date(now.getTime() - Math.floor(rand(0, 7 * DAY))));
  }

  for (const when of bookingDates) {
    const customerId = pick(customerIds);
    const roll = Math.random();
    if (roll < 0.6) {
      if (!(await bookTour(customerId, when))) await bookRoom(customerId, when);
    } else if (roll < 0.82) {
      await bookRoom(customerId, when);
    } else if (!(await bookFlight(customerId, when))) {
      await bookRoom(customerId, when);
    }
  }

  // --- reflect bookings back onto availability counters ---
  for (const t of tours) {
    const booked = Math.min(t.maxGuests, tourGuests.get(t.id) ?? 0);
    await prisma.tour.update({ data: { guestsBooked: booked }, where: { id: t.id } });
  }
  for (const f of flights) {
    const booked = Math.min(f.capacity, flightSeats.get(f.id) ?? 0);
    await prisma.flight.update({ data: { seatsAvailable: f.capacity - booked }, where: { id: f.id } });
  }

  logger.info({
    bookings: bookingCount,
    customers: customerIds.length,
    destinations: DESTINATIONS.length,
    flights: flights.length,
    hotels: HOTELS.length,
    message: 'Catalog + bookings seeded (idempotent, anchored to today)',
    reviews: reviewCount,
    rooms: rooms.length,
    tours: tours.length,
  });
}

// Seeds the demo AGENT (a staff User with role AGENT) that POST /auth/demo-login
// resolves for role=AGENT. ENV.DEMO_AGENT_EMAIL always resolves (env.ts defaults
// it) and is the exact email demo-login looks up, so the two line up with no
// extra config. Idempotent and create-only unless ADMIN_SEED_FORCE_UPDATE, same
// as the admin above. No phone: the account logs in by email (or demo-login),
// which sidesteps the cross-table phone-uniqueness dance.
async function seedDemoAgent() {
  const email = ENV.DEMO_AGENT_EMAIL;

  // Staff/customer contacts are unique ACROSS both tables (login resolves
  // customer-first), so never seed a staff agent onto an email a customer holds.
  // findUnique is unscoped, so a soft-deleted customer still counts as holding it.
  const customerClash = await prisma.customer.findUnique({
    select: { id: true },
    where: { email },
  });
  if (customerClash) {
    logger.error(
      `Demo agent seed: ${email} is already held by a CUSTOMER account - ` +
        'seeding staff onto it would shadow that login. Point ' +
        'DEMO_AGENT_EMAIL at a free address and rerun.',
    );
    process.exit(1);
  }

  // findUnique (unscoped) so a soft-deleted demo agent is reused, not duplicated
  // into a unique-constraint violation.
  const existing = await prisma.user.findUnique({
    select: { email: true, id: true },
    where: { email },
  });

  if (existing && !ENV.ADMIN_SEED_FORCE_UPDATE) {
    logger.info(
      `Demo agent seed: ${email} already exists - no changes ` +
        '(ADMIN_SEED_FORCE_UPDATE is not true).',
    );
    return;
  }

  const password = await randomDemoPassword();

  const agent = existing
    ? await prisma.user.update({
        data: {
          email,
          name: DEMO_AGENT_NAME,
          password,
          role: Role.AGENT,
          // Rotating the demo password invalidates any live demo session.
          tokenVersion: { increment: 1 },
        },
        where: { id: existing.id },
      })
    : await prisma.user.create({
        data: { email, name: DEMO_AGENT_NAME, password, role: Role.AGENT },
      });

  logger.info({
    demoAgent: { email: agent.email, id: agent.id, role: agent.role },
    message: existing
      ? 'Demo agent updated (ADMIN_SEED_FORCE_UPDATE=true)'
      : 'Demo agent created',
  });
}

// Seeds the demo CUSTOMER (a Customer row) that POST /auth/demo-login resolves
// for role=CUSTOMER, mirroring seedDemoAgent but on the customer table.
async function seedDemoCustomer() {
  const email = ENV.DEMO_CUSTOMER_EMAIL;

  // Same cross-table rule from the other side: never seed a customer onto an
  // email a staff user holds.
  const staffClash = await prisma.user.findUnique({
    select: { id: true },
    where: { email },
  });
  if (staffClash) {
    logger.error(
      `Demo customer seed: ${email} is already held by a STAFF account - ` +
        'seeding a customer onto it would collide with that login. Point ' +
        'DEMO_CUSTOMER_EMAIL at a free address and rerun.',
    );
    process.exit(1);
  }

  const existing = await prisma.customer.findUnique({
    select: { email: true, id: true },
    where: { email },
  });

  if (existing && !ENV.ADMIN_SEED_FORCE_UPDATE) {
    logger.info(
      `Demo customer seed: ${email} already exists - no changes ` +
        '(ADMIN_SEED_FORCE_UPDATE is not true).',
    );
    return;
  }

  const password = await randomDemoPassword();

  const customer = existing
    ? await prisma.customer.update({
        data: {
          email,
          name: DEMO_CUSTOMER_NAME,
          password,
          tokenVersion: { increment: 1 },
        },
        where: { id: existing.id },
      })
    : await prisma.customer.create({
        data: { email, name: DEMO_CUSTOMER_NAME, password },
      });

  logger.info({
    demoCustomer: { email: customer.email, id: customer.id },
    message: existing
      ? 'Demo customer updated (ADMIN_SEED_FORCE_UPDATE=true)'
      : 'Demo customer created',
  });
}

main()
  .catch((e: unknown) => {
    // pino takes the merge object first — (msg, err) silently drops the error
    logger.error({ err: e }, 'Error seeding database');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
