import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import mongoose from "mongoose";

import { LogModel } from "./models/Log";
import { connectDB } from "./config/db";
import { redisClient, connectRedis } from "./config/redis";

dotenv.config();

const app = express();
const server = http.createServer(app);

// ==========================================================
// SOCKET.IO
// ==========================================================

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

// ==========================================================
// MIDDLEWARE
// ==========================================================

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);

app.use(express.json());

// ==========================================================
// CONSTANTS
// ==========================================================

const STREAM_KEY = "logs:stream";

// ==========================================================
// ROOT ROUTE
// ==========================================================

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "LogPulse API Running 🚀",
  });
});

// ==========================================================
// HEALTH CHECK
// ==========================================================

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    let redisStatus = "disconnected";

    if (redisClient.isOpen) {
      try {
        await redisClient.ping();
        redisStatus = "connected";
      } catch {
        redisStatus = "error";
      }
    }

    const mongoStatus =
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected";

    const overallStatus =
      mongoStatus === "connected" ? "OK" : "ERROR";

    return res.status(overallStatus === "OK" ? 200 : 500).json({
      status: overallStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),

      services: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
    });
  } catch (error) {
    console.error("Health Check Error:", error);

    return res.status(500).json({
      status: "ERROR",
      message: "Health check failed",
    });
  }
});

// ==========================================================
// DATABASE DEBUG ROUTE
// ==========================================================

app.get("/api/debug/db", (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,

      mongodb: {
        readyState: mongoose.connection.readyState,
        readyStateText:
          mongoose.connection.readyState === 1
            ? "connected"
            : "not connected",

        host: mongoose.connection.host,

        database:
          mongoose.connection.db?.databaseName || "unknown",

        collection: LogModel.collection.name,
      },

      environment: {
        nodeEnv: process.env.NODE_ENV || "not-set",
        port: process.env.PORT || "not-set",
      },
    });
  } catch (error) {
    console.error("Database Debug Error:", error);

    return res.status(500).json({
      success: false,
      error: "Database debug failed",
    });
  }
});

// ==========================================================
// GET ALL LOGS
// ==========================================================

app.get("/api/v1/logs", async (_req: Request, res: Response) => {
  try {
    const logs = await LogModel.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Fetch Logs Error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to fetch logs",
    });
  }
});

// ==========================================================
// GET LOGS BY PROJECT
// ==========================================================

app.get(
  "/api/v1/logs/:projectId",
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;

      const logs = await LogModel.find({
        projectId,
      })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      return res.status(200).json({
        success: true,
        projectId,
        count: logs.length,
        logs,
      });
    } catch (error) {
      console.error("Project Logs Error:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to fetch project logs",
      });
    }
  }
);

// ==========================================================
// SOCKET.IO CONNECTION
// ==========================================================

io.on("connection", (socket) => {
  console.log(`🔌 Socket Connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`🔴 Socket Disconnected: ${socket.id}`);
  });
});

// ==========================================================
// VALIDATION SCHEMA
// ==========================================================

const LogIngestSchema = z.object({
  projectId: z.string().min(1),

  level: z.enum([
    "info",
    "warn",
    "error",
    "fatal",
  ]),

  message: z.string().min(1),

  metadata: z
    .record(z.string(), z.any())
    .optional(),
});

// ==========================================================
// INGEST LOG
// ==========================================================

app.post(
  "/api/v1/logs",
  async (req: Request, res: Response) => {
    console.log("====================================");
    console.log("📥 Incoming log request");
    console.log("Body:", req.body);

    // ------------------------------------------------------
    // Validate request
    // ------------------------------------------------------

    const result = LogIngestSchema.safeParse(req.body);

    if (!result.success) {
      console.error(
        "❌ Validation Error:",
        result.error.format()
      );

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

    // ------------------------------------------------------
    // Check MongoDB
    // ------------------------------------------------------

    if (mongoose.connection.readyState !== 1) {
      console.error(
        "❌ MongoDB is not connected"
      );

      return res.status(503).json({
        success: false,
        error: "MongoDB is not connected",
      });
    }

    try {
      // ====================================================
      // 1. SAVE DIRECTLY TO MONGODB
      // ====================================================

      console.log("💾 Saving log to MongoDB...");

      const savedLog = await LogModel.create({
        projectId,
        level,
        message,
        metadata,
        timestamp,
      });

      console.log(
        "✅ MongoDB log saved:",
        savedLog._id.toString()
      );

      // ====================================================
      // 2. REDIS STREAM
      // ====================================================

      let entryId = `mongo-${savedLog._id}`;

      if (redisClient.isOpen) {
        try {
          entryId = await redisClient.xAdd(
            STREAM_KEY,
            "*",
            {
              projectId,
              level,
              message,
              metadata: JSON.stringify(metadata),
              timestamp:
                timestamp.getTime().toString(),
            }
          );

          console.log(
            "📡 Redis stream entry:",
            entryId
          );
        } catch (redisError) {
          console.error(
            "⚠️ Redis Stream Error:",
            redisError
          );

          // MongoDB already succeeded.
          // Do NOT fail the request.
        }
      } else {
        console.log(
          "⚠️ Redis is not connected. Skipping stream."
        );
      }

      // ====================================================
      // 3. SOCKET.IO REAL-TIME EVENT
      // ====================================================

      io.emit("log:new", {
        id: savedLog._id.toString(),
        eventId: entryId,
        projectId,
        level,
        message,
        metadata,
        timestamp,
      });

      console.log(
        "📡 Socket.IO event emitted"
      );

      // ====================================================
      // 4. RESPONSE
      // ====================================================

      console.log(
        "✅ Log ingestion completed successfully"
      );

      console.log("====================================");

      return res.status(201).json({
        success: true,
        eventId: entryId,
        logId: savedLog._id.toString(),
        message: "Log ingested successfully",
      });
    } catch (error) {
      console.error(
        "❌ Ingestion Error:",
        error
      );

      console.log("====================================");

      return res.status(500).json({
        success: false,
        error: "Failed to ingest log",
      });
    }
  }
);

// ==========================================================
// START SERVER
// ==========================================================

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  try {
    console.log("====================================");
    console.log("🚀 Starting LogPulse...");
    console.log("====================================");

    // ------------------------------------------------------
    // MongoDB
    // ------------------------------------------------------

    await connectDB();

    console.log(
      "✅ MongoDB connected"
    );

    console.log(
      "📦 Database:",
      mongoose.connection.db?.databaseName
    );

    console.log(
      "📋 Collection:",
      LogModel.collection.name
    );

    // ------------------------------------------------------
    // Redis
    // ------------------------------------------------------

    try {
      await connectRedis();

      console.log(
        "✅ Redis connected"
      );
    } catch (redisError) {
      console.error(
        "⚠️ Redis connection failed:",
        redisError
      );

      console.log(
        "⚠️ Continuing without Redis..."
      );
    }

    // ------------------------------------------------------
    // HTTP SERVER
    // ------------------------------------------------------

    server.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log("====================================");
        console.log(
          `🚀 LogPulse running on port ${PORT}`
        );

        console.log(
          `📊 Health: /api/health`
        );

        console.log(
          `🧪 DB Debug: /api/debug/db`
        );

        console.log(
          `📋 Logs: /api/v1/logs`
        );

        console.log(
          `📡 Socket.IO Ready`
        );

        console.log(
          `💾 MongoDB persistence enabled`
        );

        console.log("====================================");
      }
    );
  } catch (error) {
    console.error(
      "❌ Startup Error:",
      error
    );

    process.exit(1);
  }
}

start();

// ==========================================================
// GRACEFUL SHUTDOWN
// ==========================================================

async function shutdown() {
  console.log(
    "🛑 Shutting down LogPulse..."
  );

  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
      console.log(
        "🔴 Redis connection closed"
      );
    }

    await mongoose.connection.close();

    console.log(
      "🔴 MongoDB connection closed"
    );

    server.close(() => {
      console.log(
        "🔴 HTTP server closed"
      );

      process.exit(0);
    });
  } catch (error) {
    console.error(
      "Shutdown Error:",
      error
    );

    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);