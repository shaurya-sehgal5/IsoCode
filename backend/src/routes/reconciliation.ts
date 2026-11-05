import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.post("/run", async (_req, res) => {
  try {
    const [payments, rateCard] = await Promise.all([
      prisma.paymentRecord.findMany({
        include: { reconciliationResults: { select: { id: true } } }
      }),
      prisma.rateCard.findFirst({ where: { isActive: true } })
    ]);

    if (!rateCard) {
      return res.status(400).json({ success: false, message: "No active rate card found." });
    }

    const orders = await prisma.order.findMany();
    const orderMap = new Map(orders.map(order => [order.orderNumber, order]));

    let matched = 0;
    let partial = 0;
    let unmatched = 0;
    let created = 0;

    for (const payment of payments) {
      if (payment.reconciliationResults.length) continue;

      const order = payment.orderReference
        ? orderMap.get(payment.orderReference)
        : undefined;

      if (!order) {
        await prisma.reconciliationResult.create({
          data: {
            paymentRecordId: payment.id,
            matchStatus: "UNMATCHED",
            actualAmount: payment.netAmount,
            matchConfidence: 0
          }
        });
        unmatched++;
        created++;
        continue;
      }

      const gross = Number(payment.grossAmount);
      const feePercent = Number(rateCard.feePercent);
      const fixedFee = Number(rateCard.fixedFee);
      const tcsPercent = Number(rateCard.tcsPercent);
      const tdsPercent = Number(rateCard.tdsPercent);

      const gatewayFee = gross * feePercent / 100 + fixedFee;
      const tcs = gross * tcsPercent / 100;
      const tds = gross * tdsPercent / 100;
      const expected = gross - gatewayFee - tcs - tds;
      const actual = Number(payment.netAmount);
      const difference = Number((actual - expected).toFixed(2));

      const orderMatches = Math.abs(Number(order.orderAmount) - gross) < 0.01;
      const isMatched = orderMatches && Math.abs(difference) < 1;
      const status = isMatched ? "MATCHED" : "PARTIAL";

      await prisma.reconciliationResult.create({
        data: {
          orderId: order.id,
          paymentRecordId: payment.id,
          matchStatus: status,
          expectedAmount: Number(expected.toFixed(2)),
          actualAmount: actual,
          difference,
          matchConfidence: orderMatches ? 1 : 0.7
        }
      });

      if (isMatched) matched++;
      else partial++;
      created++;
    }

    const [totalResults, totalClaims] = await Promise.all([
      prisma.reconciliationResult.count(),
      prisma.claim.count()
    ]);

    return res.json({
      success: true,
      message: "Reconciliation completed.",
      summary: {
        processed: created,
        matched,
        partial,
        unmatched,
        totalResults,
        existingClaims: totalClaims
      }
    });
  } catch (error) {
    console.error("Reconciliation error:", error);
    return res.status(500).json({ success: false, message: "Reconciliation failed." });
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
      orderBy: { createdAt: "desc" }
    });

    return res.json({ success: true, count: results.length, results });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not fetch reconciliation results." });
  }
});

export default router;
