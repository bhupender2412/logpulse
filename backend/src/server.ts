import express, {
  Request,
  Response,
} from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import mongoose from "mongoose";

import { LogModel } from "./models/Log";
import { connectDB } from "./config/db";
import {
  redisClient,
  connectRedis,
} from "./config/redis";

dotenv.config();

const app = express();

const server =
  http.createServer(app);

// ==========================================================
// SOCKET.IO
// ==========================================================

const io = new Server(server, {
  cors: {
    origin:
      process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

// ==========================================================
// MIDDLEWARE
// ==========================================================

app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN || "*",
  })
);

app.use(express.json());

// ==========================================================
// CONSTANTS
// ==========================================================

const STREAM_KEY =
  "logs:stream";

const ALLOWED_LEVELS = [
  "info",
  "warn",
  "error",
  "fatal",
] as const;

type LogLevel =
  (typeof ALLOWED_LEVELS)[number];

type TimeRange =
  | "1h"
  | "6h"
  | "24h"
  | "7d"
  | "30d"
  | "all";

// ==========================================================
// RANGE HELPERS
// ==========================================================

function getRangeStart(
  range: TimeRange
): Date | null {
  const now = Date.now();

  switch (range) {
    case "1h":
      return new Date(
        now - 1 * 60 * 60 * 1000
      );

    case "6h":
      return new Date(
        now - 6 * 60 * 60 * 1000
      );

    case "24h":
      return new Date(
        now - 24 * 60 * 60 * 1000
      );

    case "7d":
      return new Date(
        now - 7 * 24 * 60 * 60 * 1000
      );

    case "30d":
      return new Date(
        now - 30 * 24 * 60 * 60 * 1000
      );

    case "all":
    default:
      return null;
  }
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  max: number
): number {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function getLevelFilter(
  value: unknown
): LogLevel | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  if (
    ALLOWED_LEVELS.includes(
      value as LogLevel
    )
  ) {
    return value as LogLevel;
  }

  return null;
}

function getTimeRange(
  value: unknown
): TimeRange {
  const validRanges: TimeRange[] = [
    "1h",
    "6h",
    "24h",
    "7d",
    "30d",
    "all",
  ];

  if (
    typeof value === "string" &&
    validRanges.includes(
      value as TimeRange
    )
  ) {
    return value as TimeRange;
  }

  return "24h";
}

function buildLogMatch(
  query: Record<string, unknown>
) {
  const filter: Record<
    string,
    unknown
  > = {};

  if (
    typeof query.projectId ===
      "string" &&
    query.projectId.trim()
  ) {
    filter.projectId =
      query.projectId.trim();
  }

  const level = getLevelFilter(
    query.level
  );

  if (level) {
    filter.level = level;
  }

  if (
    typeof query.search ===
      "string" &&
    query.search.trim()
  ) {
    const search =
      query.search.trim();

    filter.$or = [
      {
        message: {
          $regex: search,
          $options: "i",
        },
      },
      {
        projectId: {
          $regex: search,
          $options: "i",
        },
      },
      {
        level: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  return filter;
}

function buildTimeMatch(
  range: TimeRange
) {
  const start =
    getRangeStart(range);

  if (!start) {
    return {};
  }

  return {
    timestamp: {
      $gte: start,
    },
  };
}

// ==========================================================
// TIME-SERIES CONFIG
// ==========================================================

interface TimeSeriesConfig {
  unit:
    | "minute"
    | "hour"
    | "day";

  binSize: number;

  bucketMs: number;
}

function getTimeSeriesConfig(
  range: TimeRange
): TimeSeriesConfig {
  switch (range) {
    case "1h":
      return {
        unit: "minute",
        binSize: 5,
        bucketMs:
          5 * 60 * 1000,
      };

    case "6h":
      return {
        unit: "minute",
        binSize: 30,
        bucketMs:
          30 * 60 * 1000,
      };

    case "24h":
      return {
        unit: "hour",
        binSize: 1,
        bucketMs:
          60 * 60 * 1000,
      };

    case "7d":
      return {
        unit: "day",
        binSize: 1,
        bucketMs:
          24 * 60 * 60 * 1000,
      };

    case "30d":
      return {
        unit: "day",
        binSize: 1,
        bucketMs:
          24 * 60 * 60 * 1000,
      };

    case "all":
    default:
      return {
        unit: "day",
        binSize: 1,
        bucketMs:
          24 * 60 * 60 * 1000,
      };
  }
}

// ==========================================================
// ALIGN TIMESTAMP TO BUCKET
// ==========================================================

function alignToBucket(
  timestamp: number,
  config: TimeSeriesConfig
): number {
  const date =
    new Date(timestamp);

  if (config.unit === "day") {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    );
  }

  if (config.unit === "hour") {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours()
    );
  }

  // minute
  const minutes =
    date.getUTCMinutes();

  const alignedMinutes =
    Math.floor(
      minutes / config.binSize
    ) * config.binSize;

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    alignedMinutes
  );
}

// ==========================================================
// FORMAT TIME-SERIES LABEL
// ==========================================================

function formatTimeSeriesLabel(
  timestamp: number,
  unit:
    | "minute"
    | "hour"
    | "day"
): string {
  const date =
    new Date(timestamp);

  if (unit === "minute") {
    return date.toLocaleTimeString(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }
    );
  }

  if (unit === "hour") {
    return date.toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        timeZone: "UTC",
      }
    );
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }
  );
}

// ==========================================================
// ROOT
// ==========================================================

app.get(
  "/",
  (_req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      message:
        "LogPulse API Running 🚀",
    });
  }
);

// ==========================================================
// HEALTH
// ==========================================================

app.get(
  "/api/health",
  async (
    _req: Request,
    res: Response
  ) => {
    try {
      let redisStatus =
        "disconnected";

      if (redisClient.isOpen) {
        try {
          await redisClient.ping();

          redisStatus =
            "connected";
        } catch {
          redisStatus = "error";
        }
      }

      const mongoStatus =
        mongoose.connection
          .readyState === 1
          ? "connected"
          : "disconnected";

      const overallStatus =
        mongoStatus === "connected"
          ? "OK"
          : "ERROR";

      return res
        .status(
          overallStatus === "OK"
            ? 200
            : 500
        )
        .json({
          status:
            overallStatus,

          uptime:
            process.uptime(),

          timestamp:
            new Date().toISOString(),

          services: {
            mongodb:
              mongoStatus,

            redis:
              redisStatus,
          },
        });
    } catch (error) {
      console.error(
        "Health Check Error:",
        error
      );

      return res.status(500).json({
        status: "ERROR",
        message:
          "Health check failed",
      });
    }
  }
);

// ==========================================================
// DATABASE DEBUG
// ==========================================================

app.get(
  "/api/debug/db",
  (_req: Request, res: Response) => {
    try {
      return res.status(200).json({
        success: true,

        mongodb: {
          readyState:
            mongoose.connection
              .readyState,

          readyStateText:
            mongoose.connection
              .readyState === 1
              ? "connected"
              : "not connected",

          host:
            mongoose.connection.host,

          database:
            mongoose.connection.db
              ?.databaseName ||
            "unknown",

          collection:
            LogModel.collection
              .name,
        },

        environment: {
          nodeEnv:
            process.env.NODE_ENV ||
            "not-set",

          port:
            process.env.PORT ||
            "not-set",
        },
      });
    } catch (error) {
      console.error(
        "Database Debug Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Database debug failed",
      });
    }
  }
);

// ==========================================================
// GET LOGS - PAGINATION
// ==========================================================

app.get(
  "/api/v1/logs",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const page =
        parsePositiveInteger(
          req.query.page,
          1,
          100000
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          25,
          100
        );

      const skip =
        (page - 1) * limit;

      const filter =
        buildLogMatch(
          req.query as Record<
            string,
            unknown
          >
        );

      const [
        logs,
        total,
      ] = await Promise.all([
        LogModel.find(filter)
          .sort({
            timestamp: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        LogModel.countDocuments(
          filter
        ),
      ]);

      const totalPages =
        Math.ceil(
          total / limit
        );

      return res.status(200).json({
        success: true,

        page,

        limit,

        total,

        totalPages,

        count: logs.length,

        hasNextPage:
          page < totalPages,

        hasPreviousPage:
          page > 1,

        filters: {
          search:
            typeof req.query
              .search === "string"
              ? req.query.search
              : "",

          projectId:
            typeof req.query
              .projectId === "string"
              ? req.query.projectId
              : "all",

          level:
            typeof req.query
              .level === "string"
              ? req.query.level
              : "all",
        },

        logs,
      });
    } catch (error) {
      console.error(
        "Fetch Logs Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch logs",
      });
    }
  }
);

// ==========================================================
// LOG STATISTICS
// ==========================================================

app.get(
  "/api/v1/logs/stats",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const range =
        getTimeRange(
          req.query.range
        );

      const baseFilter =
        buildLogMatch(
          req.query as Record<
            string,
            unknown
          >
        );

      const timeFilter =
        buildTimeMatch(range);

      const match = {
        ...baseFilter,
        ...timeFilter,
      };

      const [
        total,
        groupedLevels,
      ] = await Promise.all([
        LogModel.countDocuments(
          match
        ),

        LogModel.aggregate([
          {
            $match: match,
          },

          {
            $group: {
              _id: "$level",

              count: {
                $sum: 1,
              },
            },
          },
        ]),
      ]);

      const counts: Record<
        LogLevel,
        number
      > = {
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
      };

      groupedLevels.forEach(
        (item) => {
          if (
            ALLOWED_LEVELS.includes(
              item._id
            ) &&
            typeof item.count ===
              "number"
          ) {
            counts[
              item._id as LogLevel
            ] = item.count;
          }
        }
      );

      const serious =
        counts.error +
        counts.fatal;

      const errorRate =
        total === 0
          ? 0
          : Number(
              (
                (serious / total) *
                100
              ).toFixed(2)
            );

      return res.status(200).json({
        success: true,

        range,

        total,

        info: counts.info,

        warn: counts.warn,

        error: counts.error,

        fatal: counts.fatal,

        errorRate,
      });
    } catch (error) {
      console.error(
        "Stats Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to calculate log statistics",
      });
    }
  }
);

// ==========================================================
// PROJECT ACTIVITY STATISTICS
// ==========================================================

app.get(
  "/api/v1/logs/projects/stats",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const range =
        getTimeRange(
          req.query.range
        );

      const baseFilter =
        buildLogMatch(
          req.query as Record<
            string,
            unknown
          >
        );

      const timeFilter =
        buildTimeMatch(range);

      const match = {
        ...baseFilter,
        ...timeFilter,
      };

      const projectStats =
        await LogModel.aggregate([
          {
            $match: match,
          },

          {
            $group: {
              _id: "$projectId",

              count: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              count: -1,
              _id: 1,
            },
          },

          {
            $limit: 10,
          },
        ]);

      const total =
        projectStats.reduce(
          (sum, project) =>
            sum + project.count,
          0
        );

      const data =
        projectStats.map(
          (project) => ({
            projectId:
              project._id,

            count:
              project.count,
          })
        );

      return res.status(200).json({
        success: true,

        range,

        count: data.length,

        total,

        data,
      });
    } catch (error) {
      console.error(
        "Project Stats Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to calculate project statistics",
      });
    }
  }
);

// ==========================================================
// TIME SERIES - WITH ZERO VALUE BUCKETS
// ==========================================================

app.get(
  "/api/v1/logs/timeseries",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const range =
        getTimeRange(
          req.query.range
        );

      const baseFilter =
        buildLogMatch(
          req.query as Record<
            string,
            unknown
          >
        );

      const timeFilter =
        buildTimeMatch(range);

      const match = {
        ...baseFilter,
        ...timeFilter,
      };

      const config =
        getTimeSeriesConfig(
          range
        );

      // ------------------------------------------------------
      // MongoDB aggregation
      // ------------------------------------------------------

      const aggregated =
        await LogModel.aggregate([
          {
            $match: match,
          },

          {
            $group: {
              _id: {
                $dateTrunc: {
                  date: "$timestamp",

                  unit:
                    config.unit,

                  binSize:
                    config.binSize,

                  timezone: "UTC",
                },
              },

              info: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$level",
                        "info",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              warn: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$level",
                        "warn",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              error: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$level",
                        "error",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              fatal: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        "$level",
                        "fatal",
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              total: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              _id: 1,
            },
          },
        ]);

      // ------------------------------------------------------
      // Build map of actual buckets
      // ------------------------------------------------------

      const bucketMap =
        new Map<
          number,
          {
            info: number;
            warn: number;
            error: number;
            fatal: number;
            total: number;
          }
        >();

      aggregated.forEach(
        (item) => {
          const timestamp =
            new Date(
              item._id
            ).getTime();

          bucketMap.set(
            timestamp,
            {
              info:
                item.info || 0,

              warn:
                item.warn || 0,

              error:
                item.error || 0,

              fatal:
                item.fatal || 0,

              total:
                item.total || 0,
            }
          );
        }
      );

      // ------------------------------------------------------
      // Determine bucket range
      // ------------------------------------------------------

      let startBucket: number;

      let endBucket: number;

      if (range === "all") {
        if (
          aggregated.length ===
          0
        ) {
          return res.status(200).json({
            success: true,

            range,

            interval: {
              unit:
                config.unit,

              binSize:
                config.binSize,
            },

            count: 0,

            data: [],
          });
        }

        const timestamps =
          aggregated.map(
            (item) =>
              new Date(
                item._id
              ).getTime()
          );

        startBucket =
          Math.min(
            ...timestamps
          );

        endBucket =
          Math.max(
            ...timestamps
          );
      } else {
        const rangeStart =
          getRangeStart(range);

        if (!rangeStart) {
          startBucket =
            alignToBucket(
              Date.now(),
              config
            );

          endBucket =
            startBucket;
        } else {
          startBucket =
            alignToBucket(
              rangeStart.getTime(),
              config
            );

          endBucket =
            alignToBucket(
              Date.now(),
              config
            );
        }
      }

      // ------------------------------------------------------
      // Generate every bucket, including zeros
      // ------------------------------------------------------

      const formattedData = [];

      for (
        let current =
          startBucket;
        current <= endBucket;
        current +=
          config.bucketMs
      ) {
        const bucket =
          bucketMap.get(
            current
          );

        formattedData.push({
          label:
            formatTimeSeriesLabel(
              current,
              config.unit
            ),

          timestamp:
            new Date(
              current
            ).toISOString(),

          info:
            bucket?.info || 0,

          warn:
            bucket?.warn || 0,

          error:
            bucket?.error || 0,

          fatal:
            bucket?.fatal || 0,

          total:
            bucket?.total || 0,
        });
      }

      return res.status(200).json({
        success: true,

        range,

        interval: {
          unit:
            config.unit,

          binSize:
            config.binSize,
        },

        count:
          formattedData.length,

        data:
          formattedData,
      });
    } catch (error) {
      console.error(
        "Time Series Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to calculate time-series data",
      });
    }
  }
);

// ==========================================================
// GET LOGS BY PROJECT
// ==========================================================

app.get(
  "/api/v1/logs/:projectId",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        projectId,
      } = req.params;

      const page =
        parsePositiveInteger(
          req.query.page,
          1,
          100000
        );

      const limit =
        parsePositiveInteger(
          req.query.limit,
          25,
          100
        );

      const skip =
        (page - 1) * limit;

      const filter = {
        projectId,
      };

      const [
        logs,
        total,
      ] = await Promise.all([
        LogModel.find(filter)
          .sort({
            timestamp: -1,
          })
          .skip(skip)
          .limit(limit)
          .lean(),

        LogModel.countDocuments(
          filter
        ),
      ]);

      const totalPages =
        Math.ceil(
          total / limit
        );

      return res.status(200).json({
        success: true,

        projectId,

        page,

        limit,

        total,

        totalPages,

        count: logs.length,

        hasNextPage:
          page < totalPages,

        hasPreviousPage:
          page > 1,

        logs,
      });
    } catch (error) {
      console.error(
        "Project Logs Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch project logs",
      });
    }
  }
);

// ==========================================================
// SOCKET.IO
// ==========================================================

io.on(
  "connection",
  (socket) => {
    console.log(
      `🔌 Socket Connected: ${socket.id}`
    );

    socket.on(
      "disconnect",
      () => {
        console.log(
          `🔴 Socket Disconnected: ${socket.id}`
        );
      }
    );
  }
);

// ==========================================================
// VALIDATION
// ==========================================================

const LogIngestSchema =
  z.object({
    projectId:
      z.string().min(1),

    level:
      z.enum([
        "info",
        "warn",
        "error",
        "fatal",
      ]),

    message:
      z.string().min(1),

    metadata:
      z
        .record(
          z.string(),
          z.any()
        )
        .optional(),
  });

// ==========================================================
// INGEST LOG
// ==========================================================

app.post(
  "/api/v1/logs",
  async (
    req: Request,
    res: Response
  ) => {
    console.log(
      "===================================="
    );

    console.log(
      "📥 Incoming log request"
    );

    console.log(
      "Body:",
      req.body
    );

    const result =
      LogIngestSchema.safeParse(
        req.body
      );

    if (!result.success) {
      console.error(
        "❌ Validation Error:",
        result.error.format()
      );

      return res.status(400).json({
        success: false,
        error:
          result.error.format(),
      });
    }

    const {
      projectId,
      level,
      message,
      metadata = {},
    } = result.data;

    const timestamp =
      new Date();

    if (
      mongoose.connection
        .readyState !== 1
    ) {
      return res.status(503).json({
        success: false,
        error:
          "MongoDB is not connected",
      });
    }

    try {
      // ------------------------------------------------------
      // MongoDB
      // ------------------------------------------------------

      const savedLog =
        await LogModel.create({
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

      // ------------------------------------------------------
      // Redis
      // ------------------------------------------------------

      let entryId =
        `mongo-${savedLog._id}`;

      if (
        redisClient.isOpen
      ) {
        try {
          entryId =
            await redisClient.xAdd(
              STREAM_KEY,
              "*",
              {
                projectId,
                level,
                message,
                metadata:
                  JSON.stringify(
                    metadata
                  ),
                timestamp:
                  timestamp
                    .getTime()
                    .toString(),
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
        }
      }

      // ------------------------------------------------------
      // Socket.IO
      // ------------------------------------------------------

      io.emit("log:new", {
        id: savedLog._id
          .toString(),

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

      return res.status(201).json({
        success: true,

        eventId: entryId,

        logId:
          savedLog._id.toString(),

        message:
          "Log ingested successfully",
      });
    } catch (error) {
      console.error(
        "❌ Ingestion Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to ingest log",
      });
    }
  }
);

// ==========================================================
// START SERVER
// ==========================================================

const PORT =
  Number(process.env.PORT) ||
  4000;

async function start() {
  try {
    console.log(
      "===================================="
    );

    console.log(
      "🚀 Starting LogPulse..."
    );

    console.log(
      "===================================="
    );

    // MongoDB

    await connectDB();

    console.log(
      "✅ MongoDB connected"
    );

    console.log(
      "📦 Database:",
      mongoose.connection.db
        ?.databaseName
    );

    console.log(
      "📋 Collection:",
      LogModel.collection
        .name
    );

    // Redis

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

    // HTTP

    server.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          "===================================="
        );

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
          `📊 Stats: /api/v1/logs/stats`
        );

        console.log(
          `📈 Time Series: /api/v1/logs/timeseries`
        );

        console.log(
          `📊 Project Stats: /api/v1/logs/projects/stats`
        );

        console.log(
          `📡 Socket.IO Ready`
        );

        console.log(
          `💾 MongoDB persistence enabled`
        );

        console.log(
          "===================================="
        );
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
    if (
      redisClient.isOpen
    ) {
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

process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);