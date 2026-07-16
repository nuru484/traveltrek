-- AlterEnum
ALTER TYPE "TokenType" ADD VALUE 'TWO_FACTOR';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
