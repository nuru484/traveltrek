import * as bcrypt from 'bcrypt';

// prisma/seed.ts
import { Role } from '../generated/prisma/client';
import ENV from '../src/config/env';
import prisma from '../src/config/prismaClient';
import logger from '../src/utils/logger';

async function main() {
  logger.info('🌱 Starting database seeding...');

  const adminEmail = ENV.ADMIN_EMAIL;
  const adminPassword = ENV.ADMIN_PASSWORD;
  const adminName = ENV.ADMIN_NAME;
  const adminPhone = ENV.ADMIN_PHONE;

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    create: {
      email: adminEmail,
      name: adminName,
      password: hashedPassword,
      phone: adminPhone,
      role: Role.ADMIN,
    },
    update: {
      name: adminName,
      password: hashedPassword,
      phone: adminPhone,
      role: Role.ADMIN,
      updatedAt: new Date(),
    },
    where: { email: adminEmail },
  });

  logger.info({
    admin: {
      email: admin.email,
      id: admin.id,
      name: admin.name,
      role: admin.role,
    },
    message: '✅ Admin user seeded successfully',
  });
}

main()
  .catch((e: unknown) => {
    // pino takes the merge object first — (msg, err) silently drops the error
    logger.error({ err: e }, '❌ Error seeding database');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
