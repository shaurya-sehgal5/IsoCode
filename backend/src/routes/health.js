"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.json({
            success: true,
            message: "SettleFlow API is running",
            database: "connected",
        });
    }
    catch (error) {
        console.error(error);
        res.status(503).json({
            success: false,
            message: "Database connection failed",
            database: "disconnected",
        });
    }
});
exports.default = router;
//# sourceMappingURL=health.js.map