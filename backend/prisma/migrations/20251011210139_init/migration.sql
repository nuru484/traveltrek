/*
  Warnings:

  - You are about to drop the `_DestinationToTour` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `destinationId` to the `Tour` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_DestinationToTour" DROP CONSTRAINT "_DestinationToTour_A_fkey";

-- DropForeignKey
ALTER TABLE "_DestinationToTour" DROP CONSTRAINT "_DestinationToTour_B_fkey";

-- AlterTable
ALTER TABLE "Tour" ADD COLUMN     "destinationId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "_DestinationToTour";

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
