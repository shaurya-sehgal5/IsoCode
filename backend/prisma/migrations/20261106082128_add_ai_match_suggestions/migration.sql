-- CreateEnum
CREATE TYPE "AiSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "AiMatchSuggestion" (
    "id" TEXT NOT NULL,
    "paymentRecordId" TEXT NOT NULL,
    "suggestedOrderId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "AiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMatchSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiMatchSuggestion_status_idx" ON "AiMatchSuggestion"("status");

-- CreateIndex
CREATE INDEX "AiMatchSuggestion_paymentRecordId_idx" ON "AiMatchSuggestion"("paymentRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "AiMatchSuggestion_paymentRecordId_suggestedOrderId_key" ON "AiMatchSuggestion"("paymentRecordId", "suggestedOrderId");

-- AddForeignKey
ALTER TABLE "AiMatchSuggestion" ADD CONSTRAINT "AiMatchSuggestion_paymentRecordId_fkey" FOREIGN KEY ("paymentRecordId") REFERENCES "PaymentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMatchSuggestion" ADD CONSTRAINT "AiMatchSuggestion_suggestedOrderId_fkey" FOREIGN KEY ("suggestedOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMatchSuggestion" ADD CONSTRAINT "AiMatchSuggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
