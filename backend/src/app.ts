import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.js";
import { authenticate } from "./middleware/auth.js";

import healthRoutes from "./routes/health.js";
import uploadRoutes from "./routes/uploads.js";
import reconciliationRoutes from "./routes/reconciliation.js";
import claimsRoutes from "./routes/claims.js";
import rateCardsRoutes from "./routes/rateCards.js";
import returnsRoutes from "./routes/returns.js";
import aiMatchesRoutes from "./routes/aiMatches.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ name: "SettleFlow API", status: "running" });
});

// Public
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);

// Protected
app.use("/api/uploads", authenticate, uploadRoutes);
app.use("/api/reconciliation", authenticate, reconciliationRoutes);
app.use("/api/claims", authenticate, claimsRoutes);

// Co-founder only for rate-card modifications
app.use("/api/rate-cards", authenticate, (req, res, next) => {
  if (req.method !== "GET" && req.user?.role !== "CO_FOUNDER") {
    return res.status(403).json({
      success: false,
      message: "Only co-founders can manage rate cards"
    });
  }
  next();
}, rateCardsRoutes);

app.use("/api/returns", authenticate, returnsRoutes);
app.use("/api/ai-matches", authenticate, aiMatchesRoutes);

export default app;
