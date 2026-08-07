import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { connectDB } from "./config/db";
import { redisClient, connectRedis } from "./config/redis";
dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] },
});
app.use(cors());
app.use(express.json());
const STREAM_KEY = "logs:stream";
/* ========================= Basic Routes ========================= */ app.get(
  "/",
  (req, res) => {
    res.status(200).json({ success: true, message: "LogPulse API Running 🚀" });
  },
);
app.get("/api/health", async (req, res) => {
  try {
    await redisClient.ping();
    res
      .status(200)
      .json({
        status: "OK",
        uptime: process.uptime(),
        timestamp: new Date(),
        services: { mongodb: "connected", redis: "connected" },
      });
  } catch (error) {
    res.status(500).json({ status: "ERROR", message: "Health check failed" });
  }
});
/* ========================= Socket.IO ========================= */ io.on(
  "connection",
  (socket) => {
    console.log(`Socket Connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`Socket Disconnected: ${socket.id}`);
    });
  },
);
/* ========================= Validation Schema ========================= */ const LogIngestSchema =
  z.object({
    projectId: z.string().min(1),
    level: z.enum(["info", "warn", "error", "fatal"]),
    message: z.string().min(1),
    metadata: z.record(z.any()).optional(),
  });
/* ========================= Log Ingestion Endpoint ========================= */ app.post(
  "/api/v1/logs",
  async (req, res) => {
    const result = LogIngestSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({ success: false, error: result.error.format() });
    }
    const { projectId, level, message, metadata } = result.data;
    const timestamp = Date.now();
    try {
      const entryId = await redisClient.xAdd(STREAM_KEY, "*", {
        projectId,
        level,
        message,
        metadata: JSON.stringify(metadata || {}),
        timestamp: timestamp.toString(),
      });
      io.emit("log:new", {
        id: entryId,
        projectId,
        level,
        message,
        metadata,
        timestamp: new Date(timestamp),
      });
      return res.status(202).json({ success: true, eventId: entryId });
    } catch (error) {
      console.error("Ingestion Error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal Server Error" });
    }
  },
);
/* ========================= Startup ========================= */ const PORT =
  Number(process.env.PORT) || 4000;
async function start() {
  try {
    await connectDB();
    await connectRedis();
    server.listen(PORT, () => {
      console.log(`🚀 Ingestion API running on port ${PORT}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📡 Socket.IO Ready`);
    });
  } catch (error) {
    console.error("Startup Error:", error);
    process.exit(1);
  }
}
start();
/* ========================= Graceful Shutdown ========================= */ process.on(
  "SIGINT",
  async () => {
    console.log("Shutting down server...");
    await redisClient.quit();
    server.close();
    process.exit(0);
  },
);
process.on("SIGTERM", async () => {
  console.log("Shutting down server...");
  await redisClient.quit();
  server.close();
  process.exit(0);
});
