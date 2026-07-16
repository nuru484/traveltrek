import * as bcrypt from 'bcrypt';

// Optimal dev dataset: realistic content at sensible lengths, 25–50 rows per
// module with a heavier spread of bookings and payments for the reports.
//
//   npx tsx prisma/dev-seed-optimal.ts
//
// Wipes every module (except the admin login from .env) and reseeds it.
import prisma from '#config/prismaClient.js';

import {
  BookingStatus,
  FlightStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
  TourStatus,
  TourType,
} from '../generated/prisma/client.js';

// Deterministic PRNG so re-runs produce the same dataset.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260714);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
// min/max are whole GHS; the result is integer pesewas (whole-GHS steps of 5).
const money = (min: number, max: number) =>
  Math.round((min + rand() * (max - min)) / 5) * 5 * 100;

const DAY = 86400000;
const NOW = new Date('2026-07-14T12:00:00Z').getTime();

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?w=1200&q=80`;

const DEST_PHOTOS = [
  'photo-1568625365131-079e026a927d',
  'photo-1502602898657-3e91760cbb34',
  'photo-1523906834658-6e24ef2386f9',
  'photo-1512453979798-5ea266f8880c',
  'photo-1507525428034-b723cf961d3e',
  'photo-1506744038136-46273834b3fb',
  'photo-1476514525535-07fb3b4ae5f1',
  'photo-1441974231531-c6227db76b6e',
  'photo-1470071459604-3b5ec3a7fe05',
  'photo-1501785888041-af3ef285b470',
  'photo-1519681393784-d120267933ba',
];
const HOTEL_PHOTOS = [
  'photo-1566073771259-6a8506099945',
  'photo-1520250497591-112f2f40a3f4',
  'photo-1542314831-068cd1dbfeeb',
  'photo-1551882547-ff40c63fe5fa',
  'photo-1445019980597-93fa8acb246c',
  'photo-1582719508461-905c673771fd',
  'photo-1584132967334-10e028bd69f7',
];
const ROOM_PHOTOS = [
  'photo-1611892440504-42a792e24d32',
  'photo-1590490360182-c33d57733427',
  'photo-1631049307264-da0ec9d70304',
  'photo-1582719478250-c89cae4dc85b',
  'photo-1560448204-e02f11c3d0e2',
];
const FLIGHT_PHOTOS = [
  'photo-1436491865332-7a61a109cc05',
  'photo-1556388158-158ea5ccacbd',
  'photo-1569154941061-e231b4725ef1',
  'photo-1503146234398-d71f6a914cd4',
];

// [name, country, city, description]
const DESTINATIONS: [string, string, string, string][] = [
  [
    'Accra',
    'Ghana',
    'Accra',
    'The busy Atlantic capital where Jamestown fishing boats, Makola market and a fast-growing food scene sit minutes apart.',
  ],
  [
    'Kumasi',
    'Ghana',
    'Kumasi',
    'Heart of the Ashanti kingdom, home to the Manhyia Palace, kente weaving villages and the vast Kejetia market.',
  ],
  [
    'Cape Coast',
    'Ghana',
    'Cape Coast',
    'A historic coastline of castles and fishing harbours, gateway to the Kakum canopy walkway.',
  ],
  [
    'Busua Beach',
    'Ghana',
    'Busua',
    'A laid-back surf town with palm-lined sands, beginner-friendly waves and fresh lobster shacks.',
  ],
  [
    'Mole National Park',
    'Ghana',
    'Larabanga',
    "Ghana's largest wildlife refuge, where elephants amble past the escarpment-top lodges at dawn.",
  ],
  [
    'Ada Foah',
    'Ghana',
    'Ada Foah',
    'Where the Volta river meets the sea — estuary islands, stilt lodges and weekend sailing.',
  ],
  [
    'Akosombo',
    'Ghana',
    'Akosombo',
    'Lake Volta cruises, kayaking below the dam and quiet hillside resorts an easy drive from Accra.',
  ],
  [
    'Wli Waterfalls',
    'Ghana',
    'Hohoe',
    'The highest waterfall in West Africa, reached by a butterfly-lined trail through the Agumatsa reserve.',
  ],
  [
    'Tamale',
    'Ghana',
    'Tamale',
    'The northern crossroads city known for smocked textiles, shea butter cooperatives and moto-taxi energy.',
  ],
  [
    'Lagos',
    'Nigeria',
    'Lagos',
    'West Africa’s megacity of art galleries, nightlife, beach clubs and relentless creative hustle.',
  ],
  [
    'Abuja',
    'Nigeria',
    'Abuja',
    'A planned capital of wide boulevards, Aso Rock views and calm weekend resorts.',
  ],
  [
    'Dakar',
    'Senegal',
    'Dakar',
    'Atlantic surf, Gorée Island history and a music scene that spills into the streets after dark.',
  ],
  [
    'Saint-Louis',
    'Senegal',
    'Saint-Louis',
    'A faded-grand island city of colonial balconies, jazz festivals and pelican-filled river parks.',
  ],
  [
    'Abidjan',
    "Côte d'Ivoire",
    'Abidjan',
    'Lagoon-side skyline, grilled-fish maquis and day trips to the beach town of Grand-Bassam.',
  ],
  [
    'Lomé',
    'Togo',
    'Lomé',
    'A compact seaside capital famous for its grand market, fetish market and coastal boulevard.',
  ],
  [
    'Cotonou',
    'Benin',
    'Cotonou',
    'Gateway to the stilt village of Ganvié and the voodoo heritage route through Ouidah.',
  ],
  [
    'Marrakech',
    'Morocco',
    'Marrakech',
    'Medina lanes, riad courtyards and the nightly food theatre of Jemaa el-Fnaa square.',
  ],
  [
    'Cairo',
    'Egypt',
    'Cairo',
    'The pyramids at its edge and a thousand years of mosques, museums and Nile-side cafés within.',
  ],
  [
    'Zanzibar',
    'Tanzania',
    'Stone Town',
    'Spice-farm tours, carved doorways and dhow sails against turquoise Indian Ocean flats.',
  ],
  [
    'Serengeti',
    'Tanzania',
    'Seronera',
    'Endless plains crossed by the great migration, with balloon safaris drifting over at first light.',
  ],
  [
    'Maasai Mara',
    'Kenya',
    'Narok',
    'Big-cat country along the Mara river, best in the river-crossing months of the migration.',
  ],
  [
    'Cape Town',
    'South Africa',
    'Cape Town',
    'Table Mountain hikes, winelands an hour away and penguins on the beach at Boulders.',
  ],
  [
    'Victoria Falls',
    'Zimbabwe',
    'Victoria Falls',
    'The smoke that thunders — rainforest viewpoints, gorge swings and sunset river cruises.',
  ],
  [
    'Paris',
    'France',
    'Paris',
    'Museums, markets and café terraces along the Seine — the classic first stop in Europe.',
  ],
  [
    'Barcelona',
    'Spain',
    'Barcelona',
    'Gaudí rooftops, beach afternoons and late dinners in the Gothic Quarter.',
  ],
  [
    'Rome',
    'Italy',
    'Rome',
    'Layered ruins, trattoria lunches and fountains around every second corner.',
  ],
  [
    'Istanbul',
    'Türkiye',
    'Istanbul',
    'Two continents, one skyline of minarets — bazaars, Bosphorus ferries and meze nights.',
  ],
  [
    'Dubai',
    'United Arab Emirates',
    'Dubai',
    'Desert dunes and record-breaking towers, with old-town souks along the creek.',
  ],
  [
    'Bali',
    'Indonesia',
    'Ubud',
    'Rice-terrace mornings, temple ceremonies and surf beaches ringing the island.',
  ],
  [
    'Santorini',
    'Greece',
    'Oia',
    'White-washed villages stacked on a volcanic caldera above deep-blue water.',
  ],
];

const HOTEL_NAMES = [
  'Harbourlight Hotel',
  'The Baobab House',
  'Palm & Anchor Resort',
  'Savannah View Lodge',
  'The Weavers Court',
  'Lagoon Terrace Hotel',
  'Old Coast Guesthouse',
  'The Meridian Palms',
  'Riverstone Suites',
  'The Kapok Tree Hotel',
  'Driftwood Beach Resort',
  'Highland Crest Hotel',
  'The Caravan Serai',
  'Marina Bay Residences',
  'The Acacia Collection',
  'Sunbird Boutique Hotel',
  'The Printworks Hotel',
  'Coral Gate Resort',
  'The Observatory Hotel',
  'Garden City Lodge',
  'The Tidewater Inn',
  'Ironwood Manor',
  'The Lantern House',
  'Bluewater Sands Resort',
  'The Courtyard at Osu',
  'Stonebridge Hotel',
  'The Dhow & Spice Inn',
  'Vineyard Terrace Hotel',
];
const HOTEL_AMENITIES = [
  'Free wifi',
  'Outdoor pool',
  'Airport shuttle',
  'Restaurant and bar',
  'Fitness centre',
  'Spa and sauna',
  'Conference rooms',
  '24-hour front desk',
  'Beach access',
  'Rooftop terrace',
  'Kids play area',
  'Laundry service',
];
const ROOM_TYPES = [
  ['Standard Room', 350, 900, 2],
  ['Deluxe Room', 700, 1600, 3],
  ['Executive Suite', 1400, 3200, 4],
  ['Family Suite', 1200, 2600, 6],
  ['Presidential Suite', 3000, 6500, 6],
] as const;
const ROOM_AMENITIES = [
  'King-size bed',
  'Ocean view',
  'Air conditioning',
  'Mini bar',
  'Work desk',
  'Rain shower',
  'Balcony',
  'Smart TV',
  'Coffee machine',
];

const AIRLINES = [
  ['Africa World Airlines', 'AW'],
  ['PassionAir', 'OP'],
  ['Ethiopian Airlines', 'ET'],
  ['Kenya Airways', 'KQ'],
  ['Royal Air Maroc', 'AT'],
  ['ASKY Airlines', 'KP'],
  ['Air Peace', 'P4'],
  ['Emirates', 'EK'],
  ['Turkish Airlines', 'TK'],
  ['Air France', 'AF'],
] as const;
const FLIGHT_CLASSES = [
  'Economy',
  'Economy',
  'Economy',
  'Premium Economy',
  'Business',
  'First',
];

const TOUR_TEMPLATES: [string, TourType, string][] = [
  [
    'Castles & Canopy Walk Weekend',
    'CULTURAL',
    'Cape Coast and Elmina castle tours with a morning on the Kakum rainforest walkway and a beach evening at Brenu.',
  ],
  [
    'Ashanti Heritage Trail',
    'CULTURAL',
    'Manhyia Palace, the Prempeh II museum and hands-on days in the kente and adinkra craft villages around Kumasi.',
  ],
  [
    'Elephant Safari Express',
    'WILDLIFE',
    'Two game drives a day in Mole National Park with a guided walk to the Larabanga mosque and escarpment sundowners.',
  ],
  [
    'Surf & Chill Week',
    'BEACH',
    'Daily surf coaching at Busua with bonfire nights, a canoe trip to Butre and plenty of hammock time.',
  ],
  [
    'Volta Lake Explorer',
    'ADVENTURE',
    'Kayaking below the Akosombo dam, a full-day lake cruise and the hike to Wli falls with a night in Hohoe.',
  ],
  [
    'Estuary Island Getaway',
    'BEACH',
    'Stilt-lodge nights at Ada Foah, sailing on the estuary and beach barbecues where the Volta meets the sea.',
  ],
  [
    'City Lights & Street Food',
    'CITY',
    'A guided crawl through the best chop bars, night markets and rooftop bars, with a day of galleries in between.',
  ],
  [
    'Sahara Gateway Circuit',
    'ADVENTURE',
    'Marrakech medina days, a High Atlas pass drive and two nights under canvas in the dune camps of the south.',
  ],
  [
    'Nile & Pyramids Classic',
    'CULTURAL',
    'Giza at sunrise, the Egyptian Museum with an Egyptologist and a felucca sail before the sleeper south.',
  ],
  [
    'Spice Island Escape',
    'BEACH',
    'Stone Town walking tours, a spice farm lunch and four nights on the powder-white north coast beaches.',
  ],
  [
    'Great Migration Safari',
    'WILDLIFE',
    'Full days tracking the herds with a private guide, sundowner drives and an optional dawn balloon flight.',
  ],
  [
    'Cape Peninsula & Winelands',
    'CITY',
    'Table Mountain, the Boulders penguin colony and two unhurried tasting days in Stellenbosch and Franschhoek.',
  ],
  [
    'Falls & Gorge Adrenaline',
    'ADVENTURE',
    'Rainforest viewpoints, white-water rafting below Victoria Falls and a sunset cruise on the Zambezi.',
  ],
  [
    'Mediterranean Duo',
    'CRUISE',
    'A relaxed island-hopping sail between Santorini and neighbouring Cyclades with village dinners ashore.',
  ],
  [
    'Bosphorus & Bazaars',
    'CITY',
    'Istanbul across two continents: mosque mornings, ferry crossings, hammam afternoons and meze-table evenings.',
  ],
];

const FIRST_NAMES = [
  'Amina',
  'Kwabena',
  'Efua',
  'Yaw',
  'Zeinab',
  'Kofi',
  'Abena',
  'Selorm',
  'Nana',
  'Adjoa',
  'Tunde',
  'Chiamaka',
  'Fatou',
  'Moussa',
  'Awa',
  'Sekou',
  'Mariam',
  'Kojo',
  'Esi',
  'Kwame',
  'Akosua',
  'Ibrahim',
  'Salma',
  'Yusuf',
  'Naa',
  'Delali',
  'Femi',
  'Amara',
  'Binta',
  'Elikem',
];
const LAST_NAMES = [
  'Fuseini',
  'Mensah',
  'Owusu-Ansah',
  'Darko',
  'Alhassan',
  'Boateng',
  'Asante',
  'Agyeman',
  'Adjei',
  'Quartey',
  'Okafor',
  'Diallo',
  'Ndiaye',
  'Touré',
  'Traoré',
  'Keita',
  'Sowah',
  'Tetteh',
  'Amoah',
  'Baah',
  'Ankrah',
  'Sarpong',
  'Gyasi',
  'Addo',
  'Dogbe',
  'Nkrumah',
  'Bello',
  'Chukwu',
  'Sissoko',
  'Camara',
];
const AREAS = [
  'Osu, Accra',
  'Ahodwo, Kumasi',
  'Airport City, Accra',
  'Sagnarigu, Tamale',
  'East Legon, Accra',
  'Cantonments, Accra',
  'Asokwa, Kumasi',
  'Community 25, Tema',
  'Takoradi Harbour Area',
  'Cape Coast Pedu Estate',
  'Lekki Phase 1, Lagos',
  'Plateau, Dakar',
  'Cocody, Abidjan',
];
const SPECIAL_REQUESTS = [
  null,
  null,
  null,
  null,
  'Two vegetarian meals please, and a window seat if available.',
  'Celebrating our anniversary — a quiet table at dinner would be lovely.',
  'Travelling with an infant; we will need a cot in the room.',
  'Ground-floor room preferred, my father finds stairs difficult.',
  'We would appreciate a late checkout on the final day if possible.',
  null,
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? '';
  await wipe(adminEmail);

  // ---------- Destinations (30)
  const destinations = [];
  for (let i = 0; i < DESTINATIONS.length; i++) {
    const [name, country, city, description] = DESTINATIONS[i];
    destinations.push(
      await prisma.destination.create({
        data: {
          city,
          country,
          description,
          name,
          photo: unsplash(DEST_PHOTOS[i % DEST_PHOTOS.length]),
        },
      }),
    );
  }
  console.log(`destinations: ${destinations.length}`);

  // ---------- Hotels (28) + Rooms (~64)
  const hotels = [];
  const rooms = [];
  for (let i = 0; i < HOTEL_NAMES.length; i++) {
    const dest = destinations[i % destinations.length];
    const hotel = await prisma.hotel.create({
      data: {
        address: `${between(1, 250)} ${pick(['Beach Road', 'High Street', 'Harbour Lane', 'Independence Avenue', 'Palm Grove', 'Market Circle'])}, ${dest.city}`,
        amenities: Array.from(
          { length: between(4, 7) },
          (_, k) => HOTEL_AMENITIES[(i + k * 3) % HOTEL_AMENITIES.length],
        ),
        description: `A well-run ${['boutique', 'family-owned', 'business-friendly', 'beachfront', 'garden'][i % 5]} hotel a short ride from the centre of ${dest.city}, with helpful staff and a generous breakfast.`,
        destinationId: dest.id,
        name: HOTEL_NAMES[i],
        phone: `23330${String(2000000 + i * 7411).slice(0, 7)}`,
        photo: unsplash(HOTEL_PHOTOS[i % HOTEL_PHOTOS.length]),
        starRating: between(3, 5),
      },
    });
    hotels.push(hotel);

    const roomCount = between(2, 3);
    for (let r = 0; r < roomCount; r++) {
      const [type, minP, maxP, cap] = ROOM_TYPES[(i + r) % ROOM_TYPES.length];
      rooms.push(
        await prisma.room.create({
          data: {
            amenities: Array.from(
              { length: between(3, 5) },
              (_, k) => ROOM_AMENITIES[(i + r + k * 2) % ROOM_AMENITIES.length],
            ),
            capacity: between(1, cap),
            description: `${type} with ${pick(['garden', 'pool', 'city', 'ocean'])} views and a private bathroom.`,
            hotelId: hotel.id,
            photo: unsplash(ROOM_PHOTOS[(i + r) % ROOM_PHOTOS.length]),
            pricePerNight: money(minP, maxP),
            roomType: type,
            totalRooms: between(2, 10),
          },
        }),
      );
    }
  }
  console.log(`hotels: ${hotels.length}, rooms: ${rooms.length}`);

  // ---------- Flights (30)
  const flights = [];
  for (let i = 0; i < 30; i++) {
    const [airline, code] = AIRLINES[i % AIRLINES.length];
    const origin = destinations[i % destinations.length];
    let destIdx = (i * 7 + 3) % destinations.length;
    if (destinations[destIdx].id === origin.id)
      destIdx = (destIdx + 1) % destinations.length;
    // spread departures from 10 days ago to ~2 months out
    const departure = new Date(
      NOW + (i * 2 - 10) * DAY + between(6, 20) * 3600000,
    );
    const durationMin = between(55, 620);
    const capacity = pick([72, 118, 160, 189, 254]);
    const departed = departure.getTime() < NOW;
    flights.push(
      await prisma.flight.create({
        data: {
          airline,
          arrival: new Date(departure.getTime() + durationMin * 60000),
          capacity,
          departure,
          destinationId: destinations[destIdx].id,
          duration: durationMin,
          flightClass: FLIGHT_CLASSES[i % FLIGHT_CLASSES.length],
          flightNumber: `${code}-${200 + i * 3}`,
          originId: origin.id,
          photo: unsplash(FLIGHT_PHOTOS[i % FLIGHT_PHOTOS.length]),
          price: money(650, 9200),
          seatsAvailable: between(4, capacity - 10),
          status: departed
            ? pick([FlightStatus.LANDED, FlightStatus.DEPARTED])
            : i % 9 === 8
              ? FlightStatus.DELAYED
              : FlightStatus.SCHEDULED,
          stops: pick([0, 0, 0, 1, 1, 2]),
        },
      }),
    );
  }
  console.log(`flights: ${flights.length}`);

  // ---------- Tours (30)
  const tours = [];
  for (let i = 0; i < 30; i++) {
    const [tpl, type, description] = TOUR_TEMPLATES[i % TOUR_TEMPLATES.length];
    const dest = destinations[(i * 5 + 2) % destinations.length];
    const duration = between(2, 14);
    // start dates from ~5 months back to ~4 months ahead
    const start = new Date(NOW + (i * 9 - 150) * DAY);
    const end = new Date(start.getTime() + duration * DAY);
    const maxGuests = between(10, 40);
    const status: TourStatus =
      end.getTime() < NOW
        ? i % 11 === 10
          ? TourStatus.CANCELLED
          : TourStatus.COMPLETED
        : start.getTime() < NOW
          ? TourStatus.ONGOING
          : TourStatus.UPCOMING;
    tours.push(
      await prisma.tour.create({
        data: {
          description,
          destinationId: dest.id,
          duration,
          endDate: end,
          guestsBooked: between(0, Math.floor(maxGuests * 0.8)),
          maxGuests,
          name: `${dest.name} ${tpl}`,
          price: money(900, 14500),
          startDate: start,
          status,
          type,
        },
      }),
    );
  }
  console.log(`tours: ${tours.length}`);

  // ---------- Customers (26) + agent staff (4, admin kept)
  const password = await bcrypt.hash('Password123!', 10);
  const customers = [];
  let agents = 0;
  for (let i = 0; i < 30; i++) {
    const identity = {
      address: pick(AREAS),
      email: `${FIRST_NAMES[i].toLowerCase()}.${LAST_NAMES[i].toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      name: `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`,
      password,
      phone: `2335400${String(10000 + i * 13).slice(0, 5)}`,
    };
    if (i < 26) {
      customers.push(await prisma.customer.create({ data: identity }));
    } else {
      await prisma.user.create({ data: { ...identity, role: Role.AGENT } });
      agents++;
    }
  }
  console.log(`customers: ${customers.length}, agents: ${agents}`);

  // ---------- Bookings (~100) + Payments (~85)
  let bookings = 0;
  let payments = 0;
  let payRef = 1000;

  const bookedTourPairs = new Set<string>();
  const bookedFlightPairs = new Set<string>();

  const createPayment = async (booking: {
    bookingDate: Date;
    customerId: number;
    id: number;
    status: BookingStatus;
    totalPrice: number;
  }) => {
    let status: PaymentStatus;
    if (
      booking.status === BookingStatus.CONFIRMED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      status = PaymentStatus.COMPLETED;
    } else if (booking.status === BookingStatus.PENDING) {
      if (rand() < 0.5) return; // pending bookings often unpaid
      status = rand() < 0.7 ? PaymentStatus.PENDING : PaymentStatus.FAILED;
    } else {
      if (rand() < 0.4) return;
      status = PaymentStatus.REFUNDED;
    }
    await prisma.payment.create({
      data: {
        amount: booking.totalPrice,
        bookingId: booking.id,
        currency: 'GHS',
        customerId: booking.customerId,
        paymentDate:
          status === PaymentStatus.PENDING
            ? null
            : new Date(
                booking.bookingDate.getTime() + between(1, 48) * 3600000,
              ),
        paymentMethod: pick([
          PaymentMethod.MOBILE_MONEY,
          PaymentMethod.MOBILE_MONEY,
          PaymentMethod.CREDIT_CARD,
          PaymentMethod.DEBIT_CARD,
          PaymentMethod.BANK_TRANSFER,
        ]),
        status,
        transactionReference: `TT-PAY-2026-${payRef++}`,
      },
    });
    payments++;
  };

  const statusFor = (when: Date): BookingStatus => {
    const ageDays = (NOW - when.getTime()) / DAY;
    if (ageDays > 45)
      return rand() < 0.15 ? BookingStatus.CANCELLED : BookingStatus.COMPLETED;
    if (ageDays > 7)
      return pick([
        BookingStatus.CONFIRMED,
        BookingStatus.CONFIRMED,
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ]);
    return pick([
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.CONFIRMED,
    ]);
  };

  // spread booking dates across the last ~7 months
  const bookingDate = () =>
    new Date(NOW - between(0, 200) * DAY - between(0, 20) * 3600000);

  // Tour bookings (40)
  for (let i = 0; i < 40; i++) {
    const customer = customers[i % customers.length];
    const tour = tours[(i * 3 + 1) % tours.length];
    const key = `${customer.id}-${tour.id}`;
    if (bookedTourPairs.has(key)) continue;
    bookedTourPairs.add(key);
    const guests = between(1, 4);
    const when = bookingDate();
    const status = statusFor(when);
    const b = await prisma.booking.create({
      data: {
        bookingDate: when,
        customerId: customer.id,
        numberOfGuests: guests,
        specialRequests: pick(SPECIAL_REQUESTS),
        status,
        totalPrice: tour.price * guests,
        tourId: tour.id,
        ...(status === BookingStatus.PENDING
          ? { paymentDeadline: new Date(NOW + between(1, 5) * DAY) }
          : {}),
      },
    });
    bookings++;
    await createPayment(b);
  }

  // Flight bookings (32)
  for (let i = 0; i < 32; i++) {
    const customer = customers[(i * 2 + 5) % customers.length];
    const flight = flights[(i * 4 + 2) % flights.length];
    const key = `${customer.id}-${flight.id}`;
    if (bookedFlightPairs.has(key)) continue;
    bookedFlightPairs.add(key);
    const guests = between(1, 3);
    const when = bookingDate();
    const status = statusFor(when);
    const b = await prisma.booking.create({
      data: {
        bookingDate: when,
        customerId: customer.id,
        flightId: flight.id,
        numberOfGuests: guests,
        specialRequests: pick(SPECIAL_REQUESTS),
        status,
        totalPrice: flight.price * guests,
      },
    });
    bookings++;
    await createPayment(b);
  }

  // Room bookings (30)
  for (let i = 0; i < 30; i++) {
    const customer = customers[(i * 3 + 7) % customers.length];
    const room = rooms[(i * 5 + 3) % rooms.length];
    const nights = between(1, 6);
    const numberOfRooms = between(1, 2);
    const when = bookingDate();
    const checkIn = new Date(when.getTime() + between(3, 30) * DAY);
    const status = statusFor(when);
    const b = await prisma.booking.create({
      data: {
        bookingDate: when,
        customerId: customer.id,
        endDate: new Date(checkIn.getTime() + nights * DAY),
        numberOfGuests: between(1, room.capacity),
        numberOfNights: nights,
        numberOfRooms,
        roomId: room.id,
        specialRequests: pick(SPECIAL_REQUESTS),
        startDate: checkIn,
        status,
        totalPrice: room.pricePerNight * nights * numberOfRooms,
      },
    });
    bookings++;
    await createPayment(b);
  }

  console.log(`bookings: ${bookings}, payments: ${payments}`);
  console.log('SEEDED optimal dataset');
}

async function wipe(adminEmail: string) {
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.tour.deleteMany();
  await prisma.destination.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany({ where: { email: { not: adminEmail } } });
  console.log('wiped existing module data (admin kept)');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
