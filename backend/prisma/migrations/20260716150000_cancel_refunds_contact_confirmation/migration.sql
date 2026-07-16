-- Customer self-cancellation refunds + confirmed contact changes.
--
-- REFUND_REQUESTED: a customer cancelled a CONFIRMED booking whose payment
-- had COMPLETED — the payment parks here until an admin actions the refund.
-- EMAIL_CHANGE / PHONE_CHANGE: single-use confirmation tokens for the new
-- self-service contact-change flows; the requested contact is parked on
-- pendingEmail / pendingPhone until confirmed.

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_REQUESTED';

-- AlterEnum
ALTER TYPE "TokenType" ADD VALUE 'EMAIL_CHANGE';

-- AlterEnum
ALTER TYPE "TokenType" ADD VALUE 'PHONE_CHANGE';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "pendingPhone" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "pendingPhone" TEXT;
