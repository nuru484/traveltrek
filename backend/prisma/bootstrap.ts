// prisma/bootstrap.ts
//
// Production bootstrap: the smallest amount of data a real deployment needs
// before anyone can sign in. Deliberately NOT prisma/seed.ts, which exists to
// make a development database look alive and creates demo accounts, a demo
// catalogue and fabricated bookings.
//
// What this creates:
//   - one ADMIN from ADMIN_EMAIL / ADMIN_NAME / ADMIN_PHONE, with a GENERATED
//     temporary password printed once
//
// The password is never read from the environment. A long-lived shared
// credential sitting in a deployment's env is worth less than a value printed
// to the release log and changed at first sign-in, and it means production
// carries no ADMIN_PASSWORD at all.
//
// Idempotent: safe to run on every deploy. An existing admin - resolved by
// email OR phone, both of which are login identifiers - is left completely
// untouched: no password reset, no role change.
import * as bcrypt from 'bcrypt';
import crypto from 'node:crypto';

import ENV from '#config/env.js';
import prisma from '#config/prismaClient.js';
import logger from '#utils/logger.js';

import { Role } from '../generated/prisma/client.js';

/** Matches BCRYPT_SALT_ROUNDS and the hashes the auth service writes. */
const SALT_ROUNDS = 10;

/**
 * A temporary password that satisfies the registration rules (4-255 chars)
 * with room to spare, and is unguessable. Printed once, never stored in
 * plain text anywhere else.
 */
const generateTempPassword = (): string =>
  crypto.randomBytes(12).toString('base64url');

/**
 * Returns null rather than throwing when the admin identity is absent: this
 * runs as part of the release command, and a deployment that never intends to
 * bootstrap an admin should not have its build fail over it. The log names
 * exactly what is missing, so a bootstrap that was meant to happen is not
 * silently skipped either.
 */
const readAdminEnv = (): null | { email: string; name: string; phone: string } => {
  const missing = (['ADMIN_EMAIL', 'ADMIN_NAME'] as const).filter(
    (name) => !ENV[name],
  );
  if (missing.length > 0) {
    logger.info(
      `Bootstrap skipped: ${missing.join(', ')} not set. Set them and re-run to create the first admin.`,
    );
    return null;
  }
  return {
    email: (ENV.ADMIN_EMAIL ?? '').toLowerCase().trim(),
    name: ENV.ADMIN_NAME ?? '',
    phone: ENV.ADMIN_PHONE ?? '',
  };
};

async function main(): Promise<void> {
  // Explicit opt-in, the same shape the seed uses. Without it the step is a
  // no-op, so the admin identity can sit in the deploy's secrets permanently
  // while the account is created on exactly one run.
  if (!ENV.ADMIN_BOOTSTRAP_ENABLED) {
    logger.info(
      'Bootstrap skipped (ADMIN_BOOTSTRAP_ENABLED is not true).',
    );
    return;
  }

  const adminEnv = readAdminEnv();
  if (!adminEnv) return;
  const { email, name, phone } = adminEnv;

  // Both email and phone are unique login identifiers, so an admin created
  // any other way must be recognised rather than collided with.
  const existing = await prisma.user.findFirst({
    select: { email: true, id: true },
    where: {
      OR: [{ email }, ...(phone ? [{ phone }] : [])],
    },
  });
  if (existing) {
    logger.info(
      { admin: { email: existing.email, id: existing.id } },
      'Bootstrap: an account already holds those contacts; nothing changed',
    );
    return;
  }

  const temporaryPassword = generateTempPassword();
  const admin = await prisma.user.create({
    data: {
      email,
      name,
      password: await bcrypt.hash(temporaryPassword, SALT_ROUNDS),
      phone: phone || null,
      role: Role.ADMIN,
    },
    select: { email: true, id: true },
  });

  logger.info(
    { admin: { email: admin.email, id: admin.id } },
    'Bootstrap: admin created',
  );
  // The one place this value ever appears. Change it at first sign-in.
  logger.info(`Temporary password (change it at first sign-in): ${temporaryPassword}`);
}

main()
  .catch((error: unknown) => {
    logger.error(error, 'Bootstrap failed');
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
