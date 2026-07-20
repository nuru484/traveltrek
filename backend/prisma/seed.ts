import * as bcrypt from 'bcrypt';
import crypto from 'node:crypto';

import ENV from '#config/env.js';
import prisma from '#config/prismaClient.js';
import logger from '#utils/logger.js';

// prisma/seed.ts
//
// Seed, gated by two env flags (chosen-fintech pattern) so running
// `npm run seed` is always safe:
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
import { Role } from '../generated/prisma/client.js';

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
    logger.info('🌱 Seed skipped (ADMIN_SEED_ENABLED is not true).');
    return;
  }

  // Order is independent (distinct emails/tables); admin first keeps the log
  // reading operator-account-then-demo-principals.
  await seedAdmin();
  await seedDemoAgent();
  await seedDemoCustomer();
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
      ? '✅ Admin user updated (ADMIN_SEED_FORCE_UPDATE=true)'
      : '✅ Admin user created',
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
      `❌ Demo agent seed: ${email} is already held by a CUSTOMER account - ` +
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
      `🌱 Demo agent seed: ${email} already exists - no changes ` +
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
      ? '✅ Demo agent updated (ADMIN_SEED_FORCE_UPDATE=true)'
      : '✅ Demo agent created',
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
      `❌ Demo customer seed: ${email} is already held by a STAFF account - ` +
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
      `🌱 Demo customer seed: ${email} already exists - no changes ` +
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
      ? '✅ Demo customer updated (ADMIN_SEED_FORCE_UPDATE=true)'
      : '✅ Demo customer created',
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
