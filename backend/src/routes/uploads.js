"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const XLSX = __importStar(require("xlsx"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = /\.(csv|xlsx|xls)$/i.test(file.originalname);
        cb(allowed ? null : new Error("Only CSV and Excel files are supported"), allowed);
    },
});
const aliases = {
    orderReference: ["order id", "order_id", "order number", "order", "merchant order id", "reference"],
    transactionId: ["transaction id", "transaction_id", "payment id", "payment_id", "txn id", "utr"],
    grossAmount: ["gross amount", "amount", "transaction amount", "order amount"],
    fees: ["fee", "fees", "processing fee", "gateway fee", "charges"],
    netAmount: ["net amount", "settled amount", "settlement amount", "net credit"],
    paymentDate: ["date", "payment date", "settlement date", "created at"],
    status: ["status", "payment status", "settlement status"],
};
function suggestMapping(headers) {
    const result = {};
    for (const [field, names] of Object.entries(aliases)) {
        result[field] =
            headers.find(header => names.includes(header.toLowerCase().trim().replace(/[_-]/g, " "))) ?? null;
    }
    return result;
}
router.post("/preview", upload.single("file"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload a file" });
        }
        const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) {
            return res.status(400).json({ success: false, message: "The uploaded file is empty" });
        }
        const data = XLSX.utils.sheet_to_json(firstSheet, {
            defval: "",
            raw: false,
        });
        const headers = data.length
            ? Object.keys(data[0])
            : (XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] || []);
        if (!headers.length) {
            return res.status(400).json({ success: false, message: "No column headers found" });
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
            preview: data.slice(0, 20),
            message: "File parsed. Review the suggested column mappings before importing.",
        });
    }
    catch (error) {
        console.error("File preview error:", error);
        return res.status(400).json({
            success: false,
            message: "Could not read this file. Check that it is a valid CSV or Excel file.",
        });
    }
});
exports.default = router;
//# sourceMappingURL=uploads.js.map