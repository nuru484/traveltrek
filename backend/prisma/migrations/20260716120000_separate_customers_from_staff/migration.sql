-- Phase 5b: separate customers from staff.
--
-- User becomes STAFF-ONLY (ADMIN/AGENT); customers move to their own Customer
-- table, keeping their ids, and Booking/Payment re-point at Customer. Hand
-- written: the DDL is interleaved with the data moves so the whole cutover is
-- one atomic migration.
--
-- Ordering:
--   1. Create Customer (+ uniques/indexes).
--   2. Copy into Customer every User who is a CUSTOMER *or* owns any booking
--      or payment (same ids preserved). Staff users who also had bookings are
--      therefore copied too and stay in BOTH tables — their staff login keeps
--      working from User while their booking history hangs off their Customer
--      twin.
--   3. Bump the Customer id sequence past the copied ids.
--   4. Booking.userId -> Booking.customerId: add nullable, backfill, SET NOT
--      NULL, re-create the uniques/indexes/FK, drop the old column.
--   5. Payment.userId -> Payment.customerId: same dance.
--   6. UserSecurityToken: userId goes nullable, customerId is added, and the
--      rows of MOVED (customer-role) users re-point at Customer. A CHECK
--      enforces exactly one principal per row.
--   7. Delete the customer-role rows from User. Role.CUSTOMER stays in the
--      enum (dropping a Postgres enum value is painful) but is legacy-reserved:
--      no User row carries it anymore.

-- 1. Customer table -----------------------------------------------------------
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "googleId" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE UNIQUE INDEX "Customer_googleId_key" ON "Customer"("googleId");
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");

-- 2. Copy customer-role users AND booking/payment owners (ids preserved) ------
INSERT INTO "Customer" (
    "id", "name", "email", "phone", "googleId", "password", "address",
    "profilePicture", "tokenVersion", "failedLoginAttempts", "lockedUntil",
    "createdAt", "updatedAt", "deletedAt"
)
SELECT
    u."id", u."name", u."email", u."phone", u."googleId", u."password",
    u."address", u."profilePicture", u."tokenVersion",
    u."failedLoginAttempts", u."lockedUntil", u."createdAt", u."updatedAt",
    u."deletedAt"
FROM "User" u
WHERE u."role" = 'CUSTOMER'
   OR u."id" IN (
        SELECT DISTINCT "userId" FROM "Booking"
        UNION
        SELECT DISTINCT "userId" FROM "Payment"
   );

-- 3. Sequence: continue after the highest copied id ---------------------------
SELECT setval(
    pg_get_serial_sequence('"Customer"', 'id'),
    GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "Customer"), 1)
);

-- 4. Booking.userId -> Booking.customerId -------------------------------------
ALTER TABLE "Booking" ADD COLUMN "customerId" INTEGER;
UPDATE "Booking" SET "customerId" = "userId";
ALTER TABLE "Booking" ALTER COLUMN "customerId" SET NOT NULL;

ALTER TABLE "Booking" DROP CONSTRAINT "Booking_userId_fkey";
DROP INDEX "Booking_userId_flightId_key";
DROP INDEX "Booking_userId_roomId_startDate_endDate_key";
DROP INDEX "Booking_userId_tourId_key";
DROP INDEX "booking_user_tour_hotel_room_flight_idx";
ALTER TABLE "Booking" DROP COLUMN "userId";

CREATE UNIQUE INDEX "Booking_customerId_tourId_key" ON "Booking"("customerId", "tourId");
CREATE UNIQUE INDEX "Booking_customerId_roomId_startDate_endDate_key" ON "Booking"("customerId", "roomId", "startDate", "endDate");
CREATE UNIQUE INDEX "Booking_customerId_flightId_key" ON "Booking"("customerId", "flightId");
CREATE INDEX "booking_customer_tour_hotel_room_flight_idx" ON "Booking"("customerId", "tourId", "roomId", "flightId");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Payment.userId -> Payment.customerId -------------------------------------
ALTER TABLE "Payment" ADD COLUMN "customerId" INTEGER;
UPDATE "Payment" SET "customerId" = "userId";
ALTER TABLE "Payment" ALTER COLUMN "customerId" SET NOT NULL;

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";
DROP INDEX "payment_user_idx";
ALTER TABLE "Payment" DROP COLUMN "userId";

CREATE INDEX "payment_customer_idx" ON "Payment"("customerId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. UserSecurityToken: dual-principal FK -------------------------------------
ALTER TABLE "UserSecurityToken" ADD COLUMN "customerId" INTEGER,
    ALTER COLUMN "userId" DROP NOT NULL;

-- Tokens of users who MOVED (customer-role rows) re-point at their Customer
-- twin; staff tokens stay on User, including for staff who were also copied
-- into Customer (their sessions remain staff sessions).
UPDATE "UserSecurityToken" ust
SET "customerId" = ust."userId", "userId" = NULL
WHERE ust."userId" IN (SELECT "id" FROM "User" WHERE "role" = 'CUSTOMER');

CREATE INDEX "UserSecurityToken_customerId_type_idx" ON "UserSecurityToken"("customerId", "type");
ALTER TABLE "UserSecurityToken" ADD CONSTRAINT "UserSecurityToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one principal per token row.
ALTER TABLE "UserSecurityToken"
    ADD CONSTRAINT "UserSecurityToken_one_principal_check"
    CHECK (num_nonnulls("userId", "customerId") = 1);

-- 7. User becomes staff-only ---------------------------------------------------
DELETE FROM "User" WHERE "role" = 'CUSTOMER';
