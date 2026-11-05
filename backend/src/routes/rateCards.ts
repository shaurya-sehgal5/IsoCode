import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const rateCards = await prisma.rateCard.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json({ success: true, rateCards });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not load rate cards" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { gatewayName, feePercent, fixedFee, tcsPercent, tdsPercent } = req.body;

    if (!gatewayName || [feePercent, fixedFee, tcsPercent, tdsPercent].some(v =>
      v === undefined || !Number.isFinite(Number(v)) || Number(v) < 0
    )) {
      return res.status(400).json({ success: false, message: "Enter valid gateway and rate values" });
    }

    const rateCard = await prisma.rateCard.create({
      data: {
        gatewayName: String(gatewayName).trim(),
        feePercent: Number(feePercent),
        fixedFee: Number(fixedFee),
        tcsPercent: Number(tcsPercent),
        tdsPercent: Number(tdsPercent)
      }
    });

    res.status(201).json({ success: true, rateCard });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: "Could not create rate card. Gateway name may already exist." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { feePercent, fixedFee, tcsPercent, tdsPercent, isActive } = req.body;
    const data: Record<string, unknown> = {};

    for (const key of ["feePercent", "fixedFee", "tcsPercent", "tdsPercent"] as const) {
      if (req.body[key] !== undefined) {
        const value = Number(req.body[key]);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({ success: false, message: `Invalid ${key}` });
        }
        data[key] = value;
      }
    }

    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const rateCard = await prisma.rateCard.update({
      where: { id: req.params.id },
      data
    });

    res.json({ success: true, rateCard });
  } catch (error) {
    console.error(error);
    res.status(400).json({ success: false, message: "Could not update rate card" });
  }
});

export default router;
