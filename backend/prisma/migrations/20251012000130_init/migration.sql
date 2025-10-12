/*
  Warnings:

  - You are about to drop the column `city` on the `Hotel` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Hotel` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Hotel" DROP COLUMN "city",
DROP COLUMN "country";
