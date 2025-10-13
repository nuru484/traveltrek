/*
  Warnings:

  - You are about to drop the `Inquiry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Itinerary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PromoCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TourExclusion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TourInclusion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wishlist` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Inquiry" DROP CONSTRAINT "Inquiry_userId_fkey";

-- DropForeignKey
ALTER TABLE "Itinerary" DROP CONSTRAINT "Itinerary_tourId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_tourId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";

-- DropForeignKey
ALTER TABLE "TourExclusion" DROP CONSTRAINT "TourExclusion_tourId_fkey";

-- DropForeignKey
ALTER TABLE "TourInclusion" DROP CONSTRAINT "TourInclusion_tourId_fkey";

-- DropForeignKey
ALTER TABLE "Wishlist" DROP CONSTRAINT "Wishlist_tourId_fkey";

-- DropForeignKey
ALTER TABLE "Wishlist" DROP CONSTRAINT "Wishlist_userId_fkey";

-- DropTable
DROP TABLE "Inquiry";

-- DropTable
DROP TABLE "Itinerary";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "PromoCode";

-- DropTable
DROP TABLE "Review";

-- DropTable
DROP TABLE "TourExclusion";

-- DropTable
DROP TABLE "TourInclusion";

-- DropTable
DROP TABLE "Wishlist";

-- DropEnum
DROP TYPE "InquiryStatus";
