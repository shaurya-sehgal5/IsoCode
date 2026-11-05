-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REFUNDED', 'REJECTED');

-- CreateTable
CREATE TABLE "ReturnRecord" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "orderReference" TEXT NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "gatewayRefundId" TEXT,
    "refundDate" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRecord_returnNumber_key" ON "ReturnRecord"("returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRecord_gatewayRefundId_key" ON "ReturnRecord"("gatewayRefundId");

-- CreateIndex
CREATE INDEX "ReturnRecord_orderReference_idx" ON "ReturnRecord"("orderReference");

-- CreateIndex
CREATE INDEX "ReturnRecord_status_idx" ON "ReturnRecord"("status");

-- AddForeignKey
ALTER TABLE "ReturnRecord" ADD CONSTRAINT "ReturnRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
