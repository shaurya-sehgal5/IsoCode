import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

const BATCH_SIZE = 5000;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

router.post("/run", async (_req, res) => {
  try {
    const [payments, orders, rateCard, existingResults, totalClaims] =
      await Promise.all([
        prisma.paymentRecord.findMany(),
        prisma.order.findMany(),
        prisma.rateCard.findFirst({ where: { isActive: true } }),
        prisma.reconciliationResult.findMany({
          where: { paymentRecordId: { not: null } },
          select: { paymentRecordId: true }
        }),
        prisma.claim.count()
      ]);

    if (!rateCard) {
      return res.status(400).json({
        success: false,
        message: "No active rate card found."
      });
    }

    const orderMap = new Map(
      orders.map(order => [order.orderNumber, order])
    );

    const processedPaymentIds = new Set(
      existingResults
        .map(result => result.paymentRecordId)
        .filter((id): id is string => Boolean(id))
    );

    const feePercent = Number(rateCard.feePercent);
    const fixedFee = Number(rateCard.fixedFee);
    const tcsPercent = Number(rateCard.tcsPercent);
    const tdsPercent = Number(rateCard.tdsPercent);

    const rows: Array<{
      orderId?: string;
      paymentRecordId: string;
      matchStatus: "MATCHED" | "PARTIAL" | "UNMATCHED";
      expectedAmount?: number;
      actualAmount: number;
      difference?: number;
      matchConfidence: number;
    }> = [];

    let matched = 0;
    let partial = 0;
    let unmatched = 0;

    for (const payment of payments) {
      if (processedPaymentIds.has(payment.id)) continue;

      const actual = round2(Number(payment.netAmount));

      const order = payment.orderReference
        ? orderMap.get(payment.orderReference)
        : undefined;

      if (!order) {
        rows.push({
          paymentRecordId: payment.id,
          matchStatus: "UNMATCHED",
          actualAmount: actual,
          matchConfidence: 0
        });

        unmatched++;
        continue;
      }

      const gross = Number(payment.grossAmount);
      const gatewayFee = (gross * feePercent / 100) + fixedFee;
      const tcs = gross * tcsPercent / 100;
      const tds = gross * tdsPercent / 100;

      const expected = round2(gross - gatewayFee - tcs - tds);
      const difference = round2(actual - expected);

      const orderMatches =
        Math.abs(Number(order.orderAmount) - gross) < 0.01;

      const isMatched =
        orderMatches && Math.abs(difference) < 1;

      rows.push({
        orderId: order.id,
        paymentRecordId: payment.id,
        matchStatus: isMatched ? "MATCHED" : "PARTIAL",
        expectedAmount: expected,
        actualAmount: actual,
        difference,
        matchConfidence: isMatched ? 1 : orderMatches ? 0.9 : 0.7
      });

      if (isMatched) matched++;
      else partial++;
    }

    let created = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      const result = await prisma.reconciliationResult.createMany({
        data: batch
      });

      created += result.count;
    }

    const totalResults = await prisma.reconciliationResult.count();

    return res.json({
      success: true,
      message: "Reconciliation completed.",
      summary: {
        totalPayments: payments.length,
        processed: created,
        skippedExisting: payments.length - created,
        matched,
        partial,
        unmatched,
        totalResults,
        existingClaims: totalClaims
      }
    });
  } catch (error) {
    console.error("Reconciliation error:", error);

    return res.status(500).json({
      success: false,
      message: "Reconciliation failed."
    });
  }
});

router.get("/", async (_req, res) => {
  try {
    const results = await prisma.reconciliationResult.findMany({
      include: {
        order: true,
        paymentRecord: true,
        claim: true
      },
      orderBy: { createdAt: "desc" },
      take: 1000
    });

    return res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error("Reconciliation fetch error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch reconciliation results."
    });
  }
});

export default router;
