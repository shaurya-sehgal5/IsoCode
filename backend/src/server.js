"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const prisma_1 = require("./lib/prisma");
const PORT = Number(process.env.PORT) || 5000;
async function startServer() {
    try {
        await prisma_1.prisma.$connect();
        console.log("PostgreSQL connected");
        app_1.default.listen(PORT, () => {
            console.log(`SettleFlow running at http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=server.js.map