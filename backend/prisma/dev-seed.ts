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
run().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
