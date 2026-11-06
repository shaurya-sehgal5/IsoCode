import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "../lib/prisma.js";

const router = Router();
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

router.post("/generate", async (_req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        success: false,
        message: "Gemini API key is not configured."
      });
    }

    const payments = await prisma.paymentRecord.findMany({
      where: { OR: [{ orderReference: null }, { orderReference: "" }] },
      take: 20,
      orderBy: { createdAt: "asc" }
    });

    const orders = await prisma.order.findMany({
      select: {
        id: true,
        orderNumber: true,
        orderAmount: true,
        orderDate: true
      },
      take: 5000
    });

    let created = 0;

    for (const payment of payments) {
      const gross = Number(payment.grossAmount);
      const paymentTime = payment.paymentDate?.getTime();

      const candidates = orders.map(order => {
        const amountDifference = Math.abs(Number(order.orderAmount) - gross);
        const dayDifference = paymentTime && order.orderDate
          ? Math.abs(paymentTime - order.orderDate.getTime()) / 86400000
          : null;

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          amountDifference: round2(amountDifference),
          dayDifference: dayDifference === null ? null : round2(dayDifference)
        };
      }).filter(candidate =>
        candidate.amountDifference <= Math.max(100, gross * 0.2) &&
        (candidate.dayDifference === null || candidate.dayDifference <= 7)
      ).sort((a, b) => a.amountDifference - b.amountDifference).slice(0, 10);

      if (!candidates.length) continue;

      const response = await ai.models.generateContent({
        model,
        contents: `Choose the most likely order or return null if uncertain.
Never invent an ID. Amount and date proximity are evidence, not proof.
Payment: ${JSON.stringify({
  grossAmount: gross,
  netAmount: Number(payment.netAmount),
  paymentDate: payment.paymentDate?.toISOString() ?? null
})}
Candidates: ${JSON.stringify(candidates)}`,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: {
              selectedOrderId: { type: ["string", "null"] },
              confidence: { type: "number" },
              reason: { type: "string" },
              evidence: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["selectedOrderId", "confidence", "reason", "evidence"]
          }
        }
      });

      if (!response.text) continue;

      const result = JSON.parse(response.text);
      const selected = candidates.find(c => c.id === result.selectedOrderId);
      const confidence = Number(result.confidence);

      if (!selected || !Number.isFinite(confidence) || confidence < 0.5) continue;

      await prisma.aiMatchSuggestion.upsert({
        where: {
          paymentRecordId_suggestedOrderId: {
            paymentRecordId: payment.id,
            suggestedOrderId: selected.id
          }
        },
        update: {
          confidence: Math.min(1, Math.max(0, confidence)),
          reason: String(result.reason || "Possible order match"),
          evidence: Array.isArray(result.evidence) ? result.evidence : [],
          status: "PENDING"
        },
        create: {
          paymentRecordId: payment.id,
          suggestedOrderId: selected.id,
          confidence: Math.min(1, Math.max(0, confidence)),
          reason: String(result.reason || "Possible order match"),
          evidence: Array.isArray(result.evidence) ? result.evidence : []
        }
      });

      created++;
    }

    return res.json({
      success: true,
      paymentsScanned: payments.length,
      suggestionsCreated: created
    });
  } catch (error) {
    console.error("AI matching error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not generate suggestions."
    });
  }
});

router.get("/", async (_req, res) => {
  try {
    const suggestions = await prisma.aiMatchSuggestion.findMany({
      where: { status: "PENDING" },
      include: {
        paymentRecord: true,
        suggestedOrder: true
      },
      orderBy: { confidence: "desc" },
      take: 200
    });

    return res.json({ success: true, count: suggestions.length, suggestions });
  } catch (error) {
    console.error("AI suggestions error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load suggestions."
    });
  }
});

router.patch("/:id/review", async (req, res) => {
  try {
    const decision = req.body?.decision;

    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be APPROVE or REJECT."
      });
    }

    const suggestion = await prisma.aiMatchSuggestion.findUnique({
      where: { id: req.params.id },
      include: {
        paymentRecord: true,
        suggestedOrder: true
      }
    });

    if (!suggestion || suggestion.status !== "PENDING") {
      return res.status(404).json({
        success: false,
        message: "Pending suggestion not found."
      });
    }

    if (decision === "REJECT") {
      const rejected = await prisma.aiMatchSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: "REJECTED",
          reviewedById: req.user!.userId,
          reviewedAt: new Date()
        }
      });

      return res.json({ success: true, suggestion: rejected });
    }

    const payment = suggestion.paymentRecord;
    const order = suggestion.suggestedOrder;

    if (payment.orderReference) {
      return res.status(409).json({
        success: false,
        message: "Payment already has an order reference."
      });
    }

    const rateCard = await prisma.rateCard.findFirst({
      where: { isActive: true }
    });

    if (!rateCard) {
      return res.status(400).json({
        success: false,
        message: "No active rate card found."
      });
    }

    const gross = Number(payment.grossAmount);
    const actual = Number(payment.netAmount);

    const expected = round2(
      gross -
      (gross * Number(rateCard.feePercent) / 100 + Number(rateCard.fixedFee)) -
      gross * Number(rateCard.tcsPercent) / 100 -
      gross * Number(rateCard.tdsPercent) / 100
    );

    const difference = round2(actual - expected);
    const matched =
      Math.abs(Number(order.orderAmount) - gross) < 0.01 &&
      Math.abs(difference) < 1;

    await prisma.$transaction(async tx => {
      await tx.paymentRecord.update({
        where: { id: payment.id },
        data: { orderReference: order.orderNumber }
      });

      const existing = await tx.reconciliationResult.findFirst({
        where: { paymentRecordId: payment.id }
      });

      if (existing) {
        await tx.reconciliationResult.update({
          where: { id: existing.id },
          data: {
            orderId: order.id,
            matchStatus: matched ? "MATCHED" : "PARTIAL",
            expectedAmount: expected,
            actualAmount: actual,
            difference,
            matchConfidence: suggestion.confidence
          }
        });
      } else {
        await tx.reconciliationResult.create({
          data: {
            orderId: order.id,
            paymentRecordId: payment.id,
            matchStatus: matched ? "MATCHED" : "PARTIAL",
            expectedAmount: expected,
            actualAmount: actual,
            difference,
            matchConfidence: suggestion.confidence
          }
        });
      }

      await tx.aiMatchSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: "APPROVED",
          reviewedById: req.user!.userId,
          reviewedAt: new Date()
        }
      });
    });

    return res.json({
      success: true,
      message: "Suggestion approved and reconciliation updated."
    });
  } catch (error) {
    console.error("AI review error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not review suggestion."
    });
  }
});

export default router;
