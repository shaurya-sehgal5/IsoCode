import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const claims = await prisma.claim.findMany({
      include: {
        reconciliationResult: {
          include: { order: true, paymentRecord: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, count: claims.length, claims });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not load claims" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { paymentRecordId, title, description } = req.body;

    if (!paymentRecordId) {
      return res.status(400).json({ success: false, message: "Payment record ID is required" });
    }

    const result = await prisma.reconciliationResult.findFirst({
      where: {
        OR: [
          { paymentRecordId },
          { paymentRecord: { externalTransactionId: paymentRecordId } }
        ]
      },
      include: { claim: true, paymentRecord: true, order: true }
    });

    if (!result) {
      return res.status(404).json({ success: false, message: "Reconciliation result not found" });
    }

    if (result.claim) {
      return res.status(409).json({ success: false, message: "A claim already exists for this transaction" });
    }

    const amount = Math.abs(Number(result.difference ?? 0));
    const claim = await prisma.claim.create({
      data: {
        claimNumber: "CLM-" + Date.now(),
        title: title || "Settlement discrepancy: " + (result.order?.orderNumber || result.paymentRecord?.orderReference || paymentRecordId),
        description: description || "Automatically created from reconciliation. Difference: ₹" + amount.toFixed(2),
        amount,
        reconciliationResultId: result.id
      }
    });

    res.status(201).json({ success: true, claim });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not create claim" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const allowed = ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"];
    const status = String(req.body.status || "").toUpperCase();

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid claim status" });
    }

    const claim = await prisma.claim.update({
      where: { id: req.params.id },
      data: { status: status as "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED" }
    });

    res.json({ success: true, claim });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not update claim" });
  }
});

export default router;
