import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import healthRoutes from "./routes/health.js";
import uploadRoutes from "./routes/uploads.js";
import reconciliationRoutes from "./routes/reconciliation.js";
import claimsRoutes from "./routes/claims.js";
import rateCardsRoutes from "./routes/rateCards.js";
import returnsRoutes from "./routes/returns.js";

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

app.use("/api/health", healthRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/reconciliation", reconciliationRoutes);
app.use("/api/claims", claimsRoutes);
app.use("/api/rate-cards", rateCardsRoutes);
app.use("/api/returns", returnsRoutes);

export default app;



