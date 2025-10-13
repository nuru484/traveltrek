/*
  Warnings:

  - You are about to drop the column `price` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `roomsAvailable` on the `Room` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,roomId,startDate,endDate]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `pricePerNight` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Booking_userId_roomId_key";

-- DropIndex
DROP INDEX "room_availability_idx";

-- DropIndex
DROP INDEX "room_price_idx";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "numberOfNights" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "numberOfRooms" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "paymentDeadline" TIMESTAMP(3),
ADD COLUMN     "requiresImmediatePayment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "price",
DROP COLUMN "roomsAvailable",
ADD COLUMN     "pricePerNight" DOUBLE PRECISION NOT NULL;

-- CreateIndex
CREATE INDEX "Booking_paymentDeadline_idx" ON "Booking"("paymentDeadline");

-- CreateIndex
CREATE INDEX "Booking_startDate_endDate_idx" ON "Booking"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_userId_roomId_startDate_endDate_key" ON "Booking"("userId", "roomId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "room_price_idx" ON "Room"("pricePerNight");
