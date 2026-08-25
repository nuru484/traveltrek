-- Refunds now go through the Paystack refund API. The ledger records when the
-- reversal was claimed (before the provider call, so an interrupted refund is
-- findable), why, and the refund id Paystack holds for the charge.

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "providerRefundId" INTEGER,
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Payment_status_refundedAt_idx" ON "Payment"("status", "refundedAt");
