/*
  Warnings:

  - You are about to drop the column `location` on the `Tour` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "tour_location_idx";

-- AlterTable
ALTER TABLE "Tour" DROP COLUMN "location";
