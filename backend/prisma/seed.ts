import * as bcrypt from 'bcrypt';

import ENV from '#config/env.js';
import prisma from '#config/prismaClient.js';
import logger from '#utils/logger.js';

// prisma/seed.ts
//
// Admin seed, gated by two env flags (chosen-fintech pattern) so running
// `npm run seed` is always safe:
//   ADMIN_SEED_ENABLED       — false (default) makes the seed a logged no-op.
//   ADMIN_SEED_FORCE_UPDATE  — false (default) makes it CREATE-ONLY: an
//                              existing admin is never overwritten. Set true
//                              to push the current ADMIN_* env values onto
//                              the existing row (credential rotation).
import { Role } from '../generated/prisma/client.js';

async function main() {
  if (!ENV.ADMIN_SEED_ENABLED) {
    logger.info('🌱 Admin seed skipped (ADMIN_SEED_ENABLED is not true).');
    return;
  }

  // ADMIN_* are optional in the app ENV (production never needs them) —
  // the seed is their only reader, so it fails fast here instead.
  const adminEmail = ENV.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = ENV.ADMIN_PASSWORD;
  const adminName = ENV.ADMIN_NAME;
  const adminPhone = ENV.ADMIN_PHONE;

  if (!adminEmail || !adminPassword || !adminName || !adminPhone) {
    logger.error(
      '❌ Admin seed: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME and ADMIN_PHONE must all be set to run the seed.',
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
      `❌ Admin seed: ADMIN_EMAIL belongs to user ${String(byEmail.id)} but ` +
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
      '❌ Admin seed: the admin email/phone is already held by a CUSTOMER ' +
        'account — seeding staff onto it would shadow that login. Use a ' +
        'different contact.',
    );
    process.exit(1);
  }

  if (existing && !ENV.ADMIN_SEED_FORCE_UPDATE) {
    logger.info(
      `🌱 Admin seed: admin already exists as ${existing.email ?? existing.phone ?? String(existing.id)} — ` +
        `no changes (ADMIN_SEED_FORCE_UPDATE is not true).`,
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

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
      ? '✅ Admin user updated (ADMIN_SEED_FORCE_UPDATE=true)'
      : '✅ Admin user created',
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
