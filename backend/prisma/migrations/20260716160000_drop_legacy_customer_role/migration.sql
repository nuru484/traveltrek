-- Drop the legacy-reserved CUSTOMER value from the Role enum and default
-- User.role to AGENT (least-privileged staff role) instead of CUSTOMER.
--
-- Safe: 20260716120000_separate_customers_from_staff moved every
-- customer-role row into the Customer model and deleted them from User, so
-- no row can still carry the value on any database that ran migrations in
-- order. Postgres cannot remove a value from an enum in place, hence the
-- create-new / retype-column / swap-names dance below.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'AGENT');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");

ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'AGENT';
