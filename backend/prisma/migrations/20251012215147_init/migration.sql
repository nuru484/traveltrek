/*
  Warnings:

  - The values [BOARDING,IN_AIR] on the enum `FlightStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FlightStatus_new" AS ENUM ('SCHEDULED', 'DEPARTED', 'LANDED', 'CANCELLED', 'DELAYED');
ALTER TABLE "Flight" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Flight" ALTER COLUMN "status" TYPE "FlightStatus_new" USING ("status"::text::"FlightStatus_new");
ALTER TYPE "FlightStatus" RENAME TO "FlightStatus_old";
ALTER TYPE "FlightStatus_new" RENAME TO "FlightStatus";
DROP TYPE "FlightStatus_old";
ALTER TABLE "Flight" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;
