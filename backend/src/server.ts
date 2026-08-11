import { LogModel } from "./models/Log";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";

import { connectDB } from "./config/db";
import { redisClient, connectRedis } from "./config/redis";
// import { LogModel } from "./models/Log";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);

app.use(express.json());

const STREAM_KEY = "logs:stream";

/* ========================= Basic Routes ========================= */

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "LogPulse API Running 🚀",
  });
});

/* ========================= Health Check ========================= */

app.get("/api/health", async (_req, res) => {
  try {
    await redisClient.ping();

    res.status(200).json({
      status: "OK",
      uptime: process.uptime(),
      timestamp: new Date(),
      services: {
        mongodb: "connected",
        redis: "connected",
      },
    });
  } catch (error) {
    console.error("Health Check Error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Health check failed",
    });
  }
});

/* ========================= Socket.IO ========================= */

io.on("connection", (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Socket Disconnected: ${socket.id}`);
  });
});

/* ========================= Validation Schema ========================= */

const LogIngestSchema = z.object({
  projectId: z.string().min(1),
  level: z.enum(["info", "warn", "error", "fatal"]),
  message: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

/* ========================= Log Ingestion ========================= */

app.post("/api/v1/logs", async (req, res) => {
  const result = LogIngestSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error.format(),
    });
  }

  const {
    projectId,
    level,
    message,
    metadata = {},
  } = result.data;

  const timestamp = new Date();

  try {
    /*
     * ============================================================
     * 1. Save directly to MongoDB
     *
     * This means LogPulse no longer depends on a separate
     * background worker for persistence.
     * ============================================================
     */

    const savedLog = await LogModel.create({
      projectId,
      level,
      message,
      metadata,
      timestamp,
    });

    /*
     * ============================================================
     * 2. Also push the event to Redis
     *
     * Redis remains useful for real-time/event-stream functionality.
     * ============================================================
     */

    let entryId: string;

    try {
      entryId = await redisClient.xAdd(STREAM_KEY, "*", {
        projectId,
        level,
        message,
        metadata: JSON.stringify(metadata),
        timestamp: timestamp.getTime().toString(),
      });
    } catch (redisError) {
      console.error(
        "Redis stream error:",
        redisError
      );

      /*
       * MongoDB has already successfully stored the log.
       * Therefore, a Redis failure should not make the entire
       * ingestion request fail.
       */
      entryId = `mongo-${savedLog._id.toString()}`;
    }

    /*
     * ============================================================
     * 3. Emit real-time event through Socket.IO
     * ============================================================
     */

    io.emit("log:new", {
      id: savedLog._id.toString(),
      eventId: entryId,
      projectId,
      level,
      message,
      metadata,
      timestamp,
    });

    /*
     * ============================================================
     * 4. Return successful response
     * ============================================================
     */

    return res.status(201).json({
      success: true,
      eventId: entryId,
      logId: savedLog._id,
      message: "Log ingested successfully",
    });
  } catch (error) {
    console.error("Ingestion Error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to ingest log",
    });
  }
});

/* ========================= Startup ========================= */

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  try {
    await connectDB();
    await connectRedis();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Ingestion API running on port ${PORT}`);
      console.log(
        `📊 Health Check: http://localhost:${PORT}/api/health`
      );
      console.log(`📡 Socket.IO Ready`);
      console.log(`💾 Direct MongoDB persistence enabled`);
    });
  } catch (error) {
    console.error("Startup Error:", error);
    process.exit(1);
  }
}

start();

/* ========================= Graceful Shutdown ========================= */

async function shutdown() {
  console.log("Shutting down server...");

  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }

    server.close(() => {
      process.exit(0);
    });
  } catch (error) {
    console.error("Shutdown Error:", error);
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);