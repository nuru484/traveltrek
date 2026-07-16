-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('REFRESH', 'OTP_LOGIN', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserSecurityToken" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "replacedByTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSecurityToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSecurityToken_tokenHash_key" ON "UserSecurityToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSecurityToken_userId_type_idx" ON "UserSecurityToken"("userId", "type");

-- CreateIndex
CREATE INDEX "UserSecurityToken_expiresAt_idx" ON "UserSecurityToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserSecurityToken" ADD CONSTRAINT "UserSecurityToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
