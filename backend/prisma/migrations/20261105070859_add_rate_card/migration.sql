-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "gatewayName" TEXT NOT NULL,
    "feePercent" DECIMAL(5,2) NOT NULL,
    "fixedFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tcsPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tdsPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateCard_gatewayName_key" ON "RateCard"("gatewayName");
