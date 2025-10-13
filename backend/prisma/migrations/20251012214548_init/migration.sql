-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('SCHEDULED', 'BOARDING', 'DEPARTED', 'IN_AIR', 'LANDED', 'CANCELLED', 'DELAYED');

-- DropIndex
DROP INDEX "flight_airline_idx";

-- DropIndex
DROP INDEX "flight_number_idx";

-- DropIndex
DROP INDEX "flight_price_idx";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "numberOfGuests" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "specialRequests" TEXT;

-- AlterTable
ALTER TABLE "Flight" ADD COLUMN     "status" "FlightStatus" NOT NULL DEFAULT 'SCHEDULED';

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Flight_status_idx" ON "Flight"("status");

-- RenameIndex
ALTER INDEX "flight_departure_arrival_idx" RENAME TO "Flight_departure_arrival_idx";

-- RenameIndex
ALTER INDEX "flight_origin_destination_idx" RENAME TO "Flight_originId_destinationId_idx";

-- RenameIndex
ALTER INDEX "flight_seats_available_idx" RENAME TO "Flight_seatsAvailable_idx";
