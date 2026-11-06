import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma.js";
import { suggestColumnMapping } from "../services/gemini.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(csv|xlsx|xls)$/i.test(file.originalname)) {
      return cb(new Error("Only CSV and Excel files are supported"));
    }
    cb(null, true);
  },
});

const aliases: Record<string, string[]> = {
  orderReference: ["order id", "order number", "order", "merchant order id", "reference"],
  transactionId: ["transaction id", "payment id", "txn id", "utr"],
  grossAmount: ["gross amount", "amount", "transaction amount", "order amount"],
  fees: ["fee", "fees", "processing fee", "gateway fee", "charges"],
  netAmount: ["net amount", "settled amount", "settlement amount", "net credit"],
  paymentDate: ["date", "payment date", "settlement date", "created at"],
  status: ["status", "payment status", "settlement status"],
};

type PaymentMapping = {
  orderReference?: string | null;
  transactionId?: string | null;
  grossAmount?: string | null;
  fees?: string | null;
  netAmount?: string | null;
  paymentDate?: string | null;
  status?: string | null;
};

function suggestMapping(headers: string[]) {
  const result: Record<string, string | null> = {};

  for (const [field, names] of Object.entries(aliases)) {
    result[field] = headers.find(header =>
      names.includes(header.toLowerCase().trim().replace(/[_-]/g, " "))
    ) ?? null;
  }

  return result;
}

function readRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The uploaded file is empty");

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Could not read the first sheet");

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
}

function amount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[₹,$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function paymentDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mappedValue(row: Record<string, unknown>, column?: string | null) {
  if (!column) return undefined;
  return row[column];
}

router.post("/preview", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a file" });
    }

    const data = readRows(req.file.buffer);
    const headers = data.length ? Object.keys(data[0] ?? {}) : [];

    if (!headers.length) {
      return res.status(400).json({ success: false, message: "No column headers found" });
    }

    let aiSuggestion: Awaited<ReturnType<typeof suggestColumnMapping>> | null = null;

    try {
      aiSuggestion = await suggestColumnMapping(headers, data.slice(0, 5));
    } catch (error) {
      console.error("Gemini mapping suggestion unavailable:", error);
    }

    return res.json({
      success: true,
      file: {
        name: req.file.originalname,
        size: req.file.size,
        totalRows: data.length,
        previewRows: Math.min(data.length, 20),
      },
      headers,
      suggestedMapping: suggestMapping(headers),
      aiSuggestion: aiSuggestion?.mapping ?? null,
      aiConfidence: aiSuggestion?.confidence ?? null,
      aiExplanation: aiSuggestion?.explanation ?? null,
      mappingSource: aiSuggestion ? "GEMINI_AI" : "RULE_BASED_FALLBACK",
      preview: data.slice(0, 20),
      message: "File parsed. Review suggested mappings before importing.",
    });
  } catch (error) {
    console.error("File preview error:", error);
    return res.status(400).json({
      success: false,
      message: "Could not read this file. Check that it is a valid CSV or Excel file.",
    });
  }
});

router.post("/confirm", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload the file again" });
    }

    let mapping: PaymentMapping;
    try {
      mapping = JSON.parse(String(req.body.mapping || "{}"));
    } catch {
      return res.status(400).json({ success: false, message: "Invalid mapping JSON" });
    }

    if (!mapping.grossAmount || !mapping.netAmount) {
      return res.status(400).json({
        success: false,
        message: "Map Gross Amount and Net Amount before confirming.",
      });
    }

    const rows = readRows(req.file.buffer);
    if (!rows.length) {
      return res.status(400).json({ success: false, message: "The file contains no data rows" });
    }

    const payments = rows.flatMap(row => {
      const gross = amount(mappedValue(row, mapping.grossAmount));
      const net = amount(mappedValue(row, mapping.netAmount));
      const orderReference = String(mappedValue(row, mapping.orderReference) ?? "").trim();

      if (gross === null || net === null) return [];

      const fees = amount(mappedValue(row, mapping.fees)) ?? Math.max(0, gross - net);
      const transactionValue = mappedValue(row, mapping.transactionId);
      const transactionId = transactionValue ? String(transactionValue).trim() : null;

      return [{
        externalTransactionId: transactionId || null,
        orderReference: orderReference || null,
        grossAmount: gross,
        fees,
        netAmount: net,
        currency: "INR",
        paymentDate: paymentDate(mappedValue(row, mapping.paymentDate)),
      }];
    });

    if (!payments.length) {
      return res.status(400).json({
        success: false,
        message: "No valid payment rows found. Check your column mapping and amount values.",
      });
    }

        const result = await prisma.$transaction(async tx => {
      const previousMappings = await tx.columnMapping.findMany({
        where: { createdById: req.user!.userId, sourceName: req.file!.originalname },
        select: { version: true },
      });
      const version = previousMappings.reduce((max, item) => Math.max(max, item.version), 0) + 1;

      await tx.columnMapping.updateMany({
        where: {
          createdById: req.user!.userId,
          sourceName: req.file!.originalname,
          isActive: true
        },
        data: { isActive: false }
      });

      const savedMapping = await tx.columnMapping.create({
        data: {
          sourceName: req.file!.originalname,
          version,
          mapping: mapping as object,
          createdById: req.user!.userId,
        },
      });

      const batch = await tx.importBatch.create({
        data: {
          fileName: req.file!.originalname,
          fileType: req.file!.mimetype || "application/octet-stream",
          fileSize: req.file!.size,
          status: "PROCESSING",
          totalRows: rows.length,
          processedRows: payments.length,

          uploadedBy: {
            connect: { id: req.user!.userId }
          },

          columnMapping: {
            connect: { id: savedMapping.id }
          }
        }
      });

      let inserted = 0;
      for (let i = 0; i < payments.length; i += 5000) {
        const chunk = payments.slice(i, i + 5000);
        const created = await tx.paymentRecord.createMany({
          data: chunk.map(payment => ({
            ...payment,
            importBatchId: batch.id,
          })),
          skipDuplicates: true,
        });
        inserted += created.count;
      }

      await tx.importBatch.update({
        where: { id: batch.id },
        data: { status: "COMPLETED", processedRows: inserted },
      });

      return { batch, mapping: savedMapping, inserted };
    }, { maxWait: 10000, timeout: 120000 });

    return res.status(201).json({
      success: true,
      message: "Import confirmed and saved successfully.",
      import: {
        id: result.batch.id,
        fileName: result.batch.fileName,
        totalRows: rows.length,
        validRows: payments.length,
        insertedRows: result.inserted,
        skippedRows: payments.length - result.inserted,
        mappingVersion: result.mapping.version,
        status: "COMPLETED",
      },
    });
  } catch (error) {
    console.error("Import confirmation error:", error);
    return res.status(500).json({
      success: false,
      message: "Import failed. Check the backend logs.",
    });
  }
});


router.get("/mappings", async (req, res) => {
  try {
    const mappings = await prisma.columnMapping.findMany({
      where: { createdById: req.user!.userId },
      orderBy: [{ sourceName: "asc" }, { version: "desc" }]
    });
    return res.json({ success: true, mappings });
  } catch (error) {
    console.error("Mapping history error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load mapping history."
    });
  }
});

router.patch("/mappings/:id/activate", async (req, res) => {
  try {
    const mapping = await prisma.columnMapping.findFirst({
      where: {
        id: req.params.id,
        createdById: req.user!.userId
      }
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: "Mapping version not found."
      });
    }

    await prisma.$transaction([
      prisma.columnMapping.updateMany({
        where: {
          createdById: req.user!.userId,
          sourceName: mapping.sourceName
        },
        data: { isActive: false }
      }),
      prisma.columnMapping.update({
        where: { id: mapping.id },
        data: { isActive: true }
      })
    ]);

    return res.json({
      success: true,
      message: `Mapping version ${mapping.version} activated.`
    });
  } catch (error) {
    console.error("Mapping rollback error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not activate mapping version."
    });
  }
});

export default router;
