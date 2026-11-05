import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const returns = await prisma.returnRecord.findMany({
      include: { order: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({ success: true, count: returns.length, returns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not load returns" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { orderReference, refundAmount, reason } = req.body;
    const amount = Number(refundAmount);

    if (!orderReference || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid order reference and positive refund amount are required"
      });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber: String(orderReference).trim() }
    });

    const record = await prisma.returnRecord.create({
      data: {
        returnNumber: "RET-" + Date.now(),
        orderReference: String(orderReference).trim(),
        refundAmount: amount,
        reason: reason ? String(reason) : null,
        orderId: order?.id ?? null
      },
      include: { order: true }
    });

    res.status(201).json({ success: true, return: record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not create return record" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const allowed = ["REQUESTED", "APPROVED", "REFUNDED", "REJECTED"];
    const status = String(req.body.status || "").toUpperCase();

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid return status" });
    }

    const record = await prisma.returnRecord.update({
      where: { id: req.params.id },
      data: {
        status: status as "REQUESTED" | "APPROVED" | "REFUNDED" | "REJECTED",
        refundDate: status === "REFUNDED" ? new Date() : undefined
      },
      include: { order: true }
    });

    res.json({ success: true, return: record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not update return" });
  }
});

export default router;
