import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import projectRoutes from "./routes/projectRoutes";
import endpointRoutes from "./routes/endpointRoutes";
import dispatchRoutes from "./routes/dispatchRoutes";

import eventRoutes from "./routes/eventRoutes";

import {
  verifyToken,
} from "./utils/jwt";

import {
  verifyWebhookSignature,
} from "./utils/webhookSignature";

import {
  requireProjectApiKey,
  type ProjectAuthenticatedRequest,
} from "./middleware/apiKeyMiddleware";

import {
  requireAuth,
} from "./middleware/authMiddleware";

import express, {
  Request,
  Response,
} from "express";

import http from "http";

import {
  Server,
} from "socket.io";

import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import mongoose from "mongoose";

import {
  LogModel,
} from "./models/Log";

import {
  EndpointModel,
} from "./models/Endpoint";

import {
  WebhookEventModel,
} from "./models/WebhookEvent";

import {
  connectDB,
} from "./config/db";

import {
  redisClient,
  redisSubscriber,
  connectRedis,
  connectRedisSubscriber,
} from "./config/redis";

dotenv.config();

// ==========================================================
// REQUEST WITH RAW BODY
//
// HMAC verification must use the EXACT bytes received.
// Re-serializing req.body with JSON.stringify() is not
// guaranteed to reproduce the original request bytes.
// ==========================================================

interface RawBodyRequest
  extends Request {
  rawBody?: string;
}

// ==========================================================
// EXPRESS / HTTP
// ==========================================================

const app =
  express();

const server =
  http.createServer(
    app
  );

// ==========================================================
// SOCKET.IO
// ==========================================================

const io =
  new Server(
    server,
    {
      cors: {
        origin:
          process.env.CORS_ORIGIN ||
          "*",

        methods: [
          "GET",
          "POST",
        ],
      },
    }
  );

// ==========================================================
// MIDDLEWARE
// ==========================================================

app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN ||
      "*",
  })
);

// ==========================================================
// JSON PARSER + RAW BODY CAPTURE
//
// IMPORTANT:
//
// The worker signs:
//
// timestamp + "." + exactRequestBody
//
// Therefore verification must also use the exact raw body.
// ==========================================================

app.use(
  express.json({
    limit:
      "1mb",

    verify: (
      req,
      _res,
      buffer
    ) => {
      (
        req as RawBodyRequest
      ).rawBody =
        buffer.toString(
          "utf8"
        );
    },
  })
);

// ==========================================================
// AUTH / USER / PROJECT / ENDPOINT / DISPATCH ROUTES
// ==========================================================

app.use(
  "/api/v1/auth",
  authRoutes
);

app.use(
  "/api/v1/users",
  userRoutes
);

app.use(
  "/api/v1/projects",
  projectRoutes
);

app.use(
  "/api/v1/endpoints",
  endpointRoutes
);

app.use(
  "/api/v1/dispatch",
  dispatchRoutes
);

app.use(
  "/api/v1/events",
  eventRoutes
);
// ==========================================================
// CONSTANTS
// ==========================================================

const STREAM_KEY =
  "logs:stream";

// ==========================================================
// REAL-TIME WEBHOOK EVENTS CHANNEL
// ==========================================================

const WEBHOOK_EVENTS_CHANNEL =
  "webhook:events";

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
  const now =
    Date.now();

  switch (range) {
    case "1h":
      return new Date(
        now -
          1 *
            60 *
            60 *
            1000
      );

    case "6h":
      return new Date(
        now -
          6 *
            60 *
            60 *
            1000
      );

    case "24h":
      return new Date(
        now -
          24 *
            60 *
            60 *
            1000
      );

    case "7d":
      return new Date(
        now -
          7 *
            24 *
            60 *
            60 *
            1000
      );

    case "30d":
      return new Date(
        now -
          30 *
            24 *
            60 *
            60 *
            1000
      );

    case "all":
    default:
      return null;
  }
}

// ==========================================================
// POSITIVE INTEGER PARSER
// ==========================================================

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  max: number
): number {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    max
  );
}

// ==========================================================
// LEVEL FILTER
// ==========================================================

function getLevelFilter(
  value: unknown
): LogLevel | null {
  if (
    typeof value !==
    "string"
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

// ==========================================================
// TIME RANGE PARSER
// ==========================================================

function getTimeRange(
  value: unknown
): TimeRange {
  const validRanges:
    TimeRange[] = [
      "1h",
      "6h",
      "24h",
      "7d",
      "30d",
      "all",
    ];

  if (
    typeof value ===
      "string" &&
    validRanges.includes(
      value as TimeRange
    )
  ) {
    return value as TimeRange;
  }

  return "24h";
}

// ==========================================================
// BUILD LOG FILTER
// ==========================================================

function buildLogMatch(
  query: Record<
    string,
    unknown
  >
) {
  const filter: Record<
    string,
    unknown
  > = {};

  // --------------------------------------------------------
  // PROJECT
  // --------------------------------------------------------

  if (
    typeof query.projectId ===
      "string" &&
    query.projectId.trim() &&
    query.projectId !==
      "all"
  ) {
    filter.projectId =
      query.projectId.trim();
  }

  // --------------------------------------------------------
  // LEVEL
  // --------------------------------------------------------

  const level =
    getLevelFilter(
      query.level
    );

  if (level) {
    filter.level =
      level;
  }

  // --------------------------------------------------------
  // SEARCH
  // --------------------------------------------------------

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
          $regex:
            search,

          $options:
            "i",
        },
      },

      {
        projectId: {
          $regex:
            search,

          $options:
            "i",
        },
      },

      {
        level: {
          $regex:
            search,

          $options:
            "i",
        },
      },
    ];
  }

  return filter;
}

// ==========================================================
// BUILD TIME FILTER
// ==========================================================

function buildTimeMatch(
  range: TimeRange
) {
  const start =
    getRangeStart(
      range
    );

  if (!start) {
    return {};
  }

  return {
    timestamp: {
      $gte:
        start,
    },
  };
}

// ==========================================================
// TIME SERIES CONFIG
// ==========================================================

interface TimeSeriesConfig {
  unit:
    | "minute"
    | "hour"
    | "day";

  binSize:
    number;

  bucketMs:
    number;
}

function getTimeSeriesConfig(
  range: TimeRange
): TimeSeriesConfig {
  switch (range) {
    case "1h":
      return {
        unit:
          "minute",

        binSize:
          5,

        bucketMs:
          5 *
          60 *
          1000,
      };

    case "6h":
      return {
        unit:
          "minute",

        binSize:
          30,

        bucketMs:
          30 *
          60 *
          1000,
      };

    case "24h":
      return {
        unit:
          "hour",

        binSize:
          1,

        bucketMs:
          60 *
          60 *
          1000,
      };

    case "7d":
    case "30d":
    case "all":
    default:
      return {
        unit:
          "day",

        binSize:
          1,

        bucketMs:
          24 *
          60 *
          60 *
          1000,
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
    new Date(
      timestamp
    );

  if (
    config.unit ===
    "day"
  ) {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    );
  }

  if (
    config.unit ===
    "hour"
  ) {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours()
    );
  }

  const minutes =
    date.getUTCMinutes();

  const alignedMinutes =
    Math.floor(
      minutes /
        config.binSize
    ) *
    config.binSize;

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    alignedMinutes
  );
}

// ==========================================================
// FORMAT TIME SERIES LABEL
// ==========================================================

function formatTimeSeriesLabel(
  timestamp: number,
  unit:
    | "minute"
    | "hour"
    | "day"
): string {
  const date =
    new Date(
      timestamp
    );

  if (
    unit ===
    "minute"
  ) {
    return date.toLocaleTimeString(
      "en-US",
      {
        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false,

        timeZone:
          "UTC",
      }
    );
  }

  if (
    unit ===
    "hour"
  ) {
    return date.toLocaleString(
      "en-US",
      {
        month:
          "short",

        day:
          "numeric",

        hour:
          "2-digit",

        timeZone:
          "UTC",
      }
    );
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      timeZone:
        "UTC",
    }
  );
}

// ==========================================================
// ROOT
// PUBLIC
// ==========================================================

app.get(
  "/",
  (
    _req: Request,
    res: Response
  ) => {
    return res
      .status(200)
      .json({
        success:
          true,

        message:
          "LogPulse API Running 🚀",
      });
  }
);

// ==========================================================
// HEALTH
// PUBLIC
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

      if (
        redisClient.isOpen
      ) {
        try {
          await redisClient.ping();

          redisStatus =
            "connected";
        } catch {
          redisStatus =
            "error";
        }
      }

      const mongoStatus =
        mongoose
          .connection
          .readyState ===
        1
          ? "connected"
          : "disconnected";

      const overallStatus =
        mongoStatus ===
        "connected"
          ? "OK"
          : "ERROR";

      return res
        .status(
          overallStatus ===
            "OK"
            ? 200
            : 500
        )
        .json({
          status:
            overallStatus,

          uptime:
            process.uptime(),

          timestamp:
            new Date()
              .toISOString(),

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

      return res
        .status(500)
        .json({
          status:
            "ERROR",

          message:
            "Health check failed",
        });
    }
  }
);

// ==========================================================
// VERIFIED WEBHOOK TEST RECEIVER
//
// DEVELOPMENT ONLY
//
// This endpoint now verifies:
//
// 1. Required Pulse headers
// 2. Timestamp format
// 3. 5-minute replay window
// 4. Event exists
// 5. Endpoint exists
// 6. Signing secret exists
// 7. Exact raw request body
// 8. HMAC SHA-256 signature
//
// SUCCESS:
//
// HTTP 200
// verified: true
//
// FAILURE:
//
// HTTP 401
// verified: false
// ==========================================================

app.post(
  "/api/test/webhook",
  async (
    req: RawBodyRequest,
    res: Response
  ) => {
    try {
      // ====================================================
      // HEADERS
      // ====================================================

      const eventId =
        req.header(
          "x-pulse-event-id"
        );

      const attempt =
        req.header(
          "x-pulse-attempt"
        );

      const timestamp =
        req.header(
          "x-pulse-timestamp"
        );

      const signature =
        req.header(
          "x-pulse-signature"
        );

      // ====================================================
      // REQUIRED SECURITY HEADERS
      // ====================================================

      if (
        !eventId ||
        !timestamp ||
        !signature
      ) {
        console.error(
          "❌ Missing webhook security headers"
        );

        return res
          .status(401)
          .json({
            success:
              false,

            verified:
              false,

            error:
              "Missing webhook security headers",
          });
      }

      // ====================================================
      // TIMESTAMP FORMAT
      // ====================================================

      if (
        !/^\d+$/.test(
          timestamp
        )
      ) {
        console.error(
          "❌ Invalid webhook timestamp format"
        );

        return res
          .status(401)
          .json({
            success:
              false,

            verified:
              false,

            error:
              "Invalid webhook timestamp",
          });
      }

      const timestampNumber =
        Number(
          timestamp
        );

      if (
        !Number.isSafeInteger(
          timestampNumber
        ) ||
        timestampNumber <= 0
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            verified:
              false,

            error:
              "Invalid webhook timestamp",
          });
      }

      // ====================================================
      // REPLAY PROTECTION
      //
      // Webhook timestamp must be within 5 minutes.
      // ====================================================

      const nowSeconds =
        Math.floor(
          Date.now() /
            1000
        );

      const timestampAgeSeconds =
        Math.abs(
          nowSeconds -
            timestampNumber
        );

      const MAX_TIMESTAMP_AGE_SECONDS =
        5 *
        60;

      if (
        timestampAgeSeconds >
        MAX_TIMESTAMP_AGE_SECONDS
      ) {
        console.error(
          "❌ Webhook rejected: expired timestamp"
        );

        return res
          .status(401)
          .json({
            success:
              false,

            verified:
              false,

            error:
              "Webhook timestamp expired",
          });
      }

      // ====================================================
      // FIND WEBHOOK EVENT
      // ====================================================

      const webhookEvent =
        await WebhookEventModel.findOne({
          eventId,
        }).lean();

      if (
        !webhookEvent
      ) {
        console.error(
          "❌ Unknown webhook event:",
          eventId
        );

        return res
          .status(401)
          .json({
            success:
              false,

            verified:
              false,

            error:
              "Unknown webhook event",
          });
      }

      // ====================================================
      // FIND ENDPOINT + SIGNING SECRET
      //
      // signingSecret is select:false.
      // We explicitly request it here.
      // ====================================================

      const endpoint =
        await EndpointModel.findOne({
          endpointId:
            webhookEvent.endpointId,

          projectId:
            webhookEvent.projectId,
        }).select(
          "+signingSecret"
        );

      if (!endpoint) {
        console.error(
          "❌ Webhook endpoint not found"
        );

        return res
          .status(401)
          .json({
            success:
              false,

            verified:
              false,

            error:
              "Webhook endpoint not found",
          });
      }

      const signingSecret =
        endpoint.signingSecret;

      if (
        typeof signingSecret !==
          "string" ||
        !signingSecret.trim()
      ) {
        console.error(
          "❌ Signing secret unavailable"
        );

        return res
          .status(401)
          .json({
            success:
              false,

            verified:
              false,

            error:
              "Webhook signing configuration unavailable",
          });
      }

      // ====================================================
      // EXACT RAW BODY
      // ====================================================

      const rawBody =
        req.rawBody;

      if (
        typeof rawBody !==
          "string"
      ) {
        console.error(
          "❌ Raw webhook body unavailable"
        );

        return res
          .status(400)
          .json({
            success:
              false,

            verified:
              false,

            error:
              "Raw webhook body unavailable",
          });
      }

      // ====================================================
      // VERIFY HMAC
      //
      // Expected signed value:
      //
      // timestamp.rawBody
      //
      // Same algorithm used by webhookWorker.ts.
      // ====================================================

      const verified =
        verifyWebhookSignature(
          rawBody,
          signingSecret,
          timestamp,
          signature
        );

      // ====================================================
      // INVALID SIGNATURE
      // ====================================================

      if (!verified) {
        console.error(
          "❌ Webhook signature verification failed"
        );

        return res
          .status(401)
          .json({
            success:
              false,

            verified:
              false,

            error:
              "Invalid webhook signature",
          });
      }

      // ====================================================
      // VERIFIED WEBHOOK
      // ====================================================

      console.log(
        "===================================="
      );

      console.log(
        "✅ Verified webhook received"
      );

      console.log(
        "Event ID:",
        eventId
      );

      console.log(
        "Attempt:",
        attempt ||
        "unknown"
      );

      console.log(
        "Timestamp:",
        timestamp
      );

      console.log(
        "Timestamp age:",
        `${timestampAgeSeconds}s`
      );

      console.log(
        "Signature valid:",
        true
      );

      console.log(
        "Payload:",
        req.body
      );

      console.log(
        "===================================="
      );

      return res
        .status(200)
        .json({
          success:
            true,

          received:
            true,

          verified:
            true,

          eventId,

          attempt:
            attempt ||
            null,

          message:
            "Webhook signature verified successfully",

          receivedAt:
            new Date()
              .toISOString(),
        });
    } catch (error) {
      console.error(
        "Webhook Verification Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          verified:
            false,

          error:
            "Webhook verification failed",
        });
    }
  }
);

// ==========================================================
// FAILING WEBHOOK TEST RECEIVER
//
// DEVELOPMENT ONLY
//
// This intentionally returns HTTP 500.
//
// It remains useful for:
//
// BullMQ retries
// exponential backoff
// signed retries
// attempt history
//
// Unlike /api/test/webhook, this route intentionally does
// not perform HMAC validation because its job is simply to
// simulate an unavailable third-party endpoint.
// ==========================================================

app.post(
  "/api/test/webhook/fail",
  (
    req: Request,
    res: Response
  ) => {
    const eventId =
      req.header(
        "x-pulse-event-id"
      );

    const attempt =
      req.header(
        "x-pulse-attempt"
      );

    const timestamp =
      req.header(
        "x-pulse-timestamp"
      );

    const signature =
      req.header(
        "x-pulse-signature"
      );

    console.log(
      "===================================="
    );

    console.log(
      "🔥 Intentional failing webhook received"
    );

    console.log(
      "Event ID:",
      eventId
    );

    console.log(
      "Attempt:",
      attempt
    );

    console.log(
      "Timestamp:",
      timestamp
    );

    console.log(
      "Signed:",
      Boolean(
        timestamp &&
        signature
      )
    );

    console.log(
      "Payload:",
      req.body
    );

    console.log(
      "===================================="
    );

    return res
      .status(500)
      .json({
        success:
          false,

        eventId:
          eventId ||
          null,

        attempt:
          attempt ||
          null,

        signed:
          Boolean(
            timestamp &&
            signature
          ),

        error:
          "Intentional webhook failure",

        receivedAt:
          new Date()
            .toISOString(),
      });
  }
);

// ==========================================================
// DATABASE DEBUG
// JWT PROTECTED
// ==========================================================

app.get(
  "/api/debug/db",
  requireAuth,
  (
    _req: Request,
    res: Response
  ) => {
    try {
      return res
        .status(200)
        .json({
          success:
            true,

          mongodb: {
            readyState:
              mongoose
                .connection
                .readyState,

            readyStateText:
              mongoose
                .connection
                .readyState ===
              1
                ? "connected"
                : "not connected",

            host:
              mongoose
                .connection
                .host,

            database:
              mongoose
                .connection
                .db
                ?.databaseName ||
              "unknown",

            collection:
              LogModel
                .collection
                .name,
          },

          environment: {
            nodeEnv:
              process.env
                .NODE_ENV ||
              "not-set",

            port:
              process.env
                .PORT ||
              "not-set",
          },
        });
    } catch (error) {
      console.error(
        "Database Debug Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Database debug failed",
        });
    }
  }
);

// ==========================================================
// GET LOGS
// JWT PROTECTED
// ==========================================================

app.get(
  "/api/v1/logs",
  requireAuth,
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
        (page - 1) *
        limit;

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
      ] =
        await Promise.all([
          LogModel.find(
            filter
          )
            .sort({
              timestamp:
                -1,
            })
            .skip(
              skip
            )
            .limit(
              limit
            )
            .lean(),

          LogModel.countDocuments(
            filter
          ),
        ]);

      const totalPages =
        Math.ceil(
          total /
            limit
        );

      return res
        .status(200)
        .json({
          success:
            true,

          page,

          limit,

          total,

          totalPages,

          count:
            logs.length,

          hasNextPage:
            page <
            totalPages,

          hasPreviousPage:
            page > 1,

          filters: {
            search:
              typeof req
                .query
                .search ===
              "string"
                ? req
                    .query
                    .search
                : "",

            projectId:
              typeof req
                .query
                .projectId ===
              "string"
                ? req
                    .query
                    .projectId
                : "all",

            level:
              typeof req
                .query
                .level ===
              "string"
                ? req
                    .query
                    .level
                : "all",
          },

          logs,
        });
    } catch (error) {
      console.error(
        "Fetch Logs Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch logs",
        });
    }
  }
);

// ==========================================================
// LOG STATISTICS
// JWT PROTECTED
// ==========================================================

app.get(
  "/api/v1/logs/stats",
  requireAuth,
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
        buildTimeMatch(
          range
        );

      const match = {
        ...baseFilter,
        ...timeFilter,
      };

      const [
        total,
        groupedLevels,
      ] =
        await Promise.all([
          LogModel.countDocuments(
            match
          ),

          LogModel.aggregate([
            {
              $match:
                match,
            },

            {
              $group: {
                _id:
                  "$level",

                count: {
                  $sum:
                    1,
                },
              },
            },
          ]),
        ]);

      const counts: Record<
        LogLevel,
        number
      > = {
        info:
          0,

        warn:
          0,

        error:
          0,

        fatal:
          0,
      };

      groupedLevels.forEach(
        (
          item
        ) => {
          if (
            ALLOWED_LEVELS.includes(
              item._id as LogLevel
            ) &&
            typeof item.count ===
              "number"
          ) {
            counts[
              item._id as LogLevel
            ] =
              item.count;
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
                (serious /
                  total) *
                100
              ).toFixed(
                2
              )
            );

      return res
        .status(200)
        .json({
          success:
            true,

          range,

          total,

          info:
            counts.info,

          warn:
            counts.warn,

          error:
            counts.error,

          fatal:
            counts.fatal,

          errorRate,
        });
    } catch (error) {
      console.error(
        "Stats Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to calculate log statistics",
        });
    }
  }
);

// ==========================================================
// PROJECT ACTIVITY STATISTICS
// JWT PROTECTED
// ==========================================================

app.get(
  "/api/v1/logs/projects/stats",
  requireAuth,
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
        buildTimeMatch(
          range
        );

      const match = {
        ...baseFilter,
        ...timeFilter,
      };

      const projectStats =
        await LogModel.aggregate([
          {
            $match:
              match,
          },

          {
            $group: {
              _id:
                "$projectId",

              count: {
                $sum:
                  1,
              },
            },
          },

          {
            $sort: {
              count:
                -1,

              _id:
                1,
            },
          },

          {
            $limit:
              10,
          },
        ]);

      const total =
        projectStats.reduce(
          (
            sum,
            project
          ) =>
            sum +
            project.count,
          0
        );

      const data =
        projectStats.map(
          (
            project
          ) => ({
            projectId:
              project._id,

            count:
              project.count,
          })
        );

      return res
        .status(200)
        .json({
          success:
            true,

          range,

          count:
            data.length,

          total,

          data,
        });
    } catch (error) {
      console.error(
        "Project Stats Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to calculate project statistics",
        });
    }
  }
);

// ==========================================================
// TIME SERIES
// ZERO VALUE BUCKETS
// JWT PROTECTED
// ==========================================================

app.get(
  "/api/v1/logs/timeseries",
  requireAuth,
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
        buildTimeMatch(
          range
        );

      const match = {
        ...baseFilter,
        ...timeFilter,
      };

      const config =
        getTimeSeriesConfig(
          range
        );

      // ====================================================
      // MONGODB AGGREGATION
      // ====================================================

      const aggregated =
        await LogModel.aggregate([
          {
            $match:
              match,
          },

          {
            $group: {
              _id: {
                $dateTrunc: {
                  date:
                    "$timestamp",

                  unit:
                    config.unit,

                  binSize:
                    config.binSize,

                  timezone:
                    "UTC",
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
                $sum:
                  1,
              },
            },
          },

          {
            $sort: {
              _id:
                1,
            },
          },
        ]);

      // ====================================================
      // BUILD BUCKET MAP
      // ====================================================

      const bucketMap =
        new Map<
          number,
          {
            info:
              number;

            warn:
              number;

            error:
              number;

            fatal:
              number;

            total:
              number;
          }
        >();

      aggregated.forEach(
        (
          item
        ) => {
          const timestamp =
            new Date(
              item._id
            ).getTime();

          bucketMap.set(
            timestamp,
            {
              info:
                item.info ||
                0,

              warn:
                item.warn ||
                0,

              error:
                item.error ||
                0,

              fatal:
                item.fatal ||
                0,

              total:
                item.total ||
                0,
            }
          );
        }
      );

      // ====================================================
      // DETERMINE RANGE
      // ====================================================

      let startBucket:
        number;

      let endBucket:
        number;

      if (
        range ===
        "all"
      ) {
        if (
          aggregated.length ===
          0
        ) {
          return res
            .status(200)
            .json({
              success:
                true,

              range,

              interval: {
                unit:
                  config.unit,

                binSize:
                  config.binSize,
              },

              count:
                0,

              data:
                [],
            });
        }

        const timestamps =
          aggregated.map(
            (
              item
            ) =>
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
          getRangeStart(
            range
          );

        if (
          !rangeStart
        ) {
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
              rangeStart
                .getTime(),
              config
            );

          endBucket =
            alignToBucket(
              Date.now(),
              config
            );
        }
      }

      // ====================================================
      // GENERATE ZERO + REAL BUCKETS
      // ====================================================

      const formattedData:
        Array<{
          label:
            string;

          timestamp:
            string;

          info:
            number;

          warn:
            number;

          error:
            number;

          fatal:
            number;

          total:
            number;
        }> = [];

      for (
        let current =
          startBucket;
        current <=
        endBucket;
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
            bucket?.info ||
            0,

          warn:
            bucket?.warn ||
            0,

          error:
            bucket?.error ||
            0,

          fatal:
            bucket?.fatal ||
            0,

          total:
            bucket?.total ||
            0,
        });
      }

      return res
        .status(200)
        .json({
          success:
            true,

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

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to calculate time-series data",
        });
    }
  }
);

// ==========================================================
// GET LOGS BY PROJECT
// JWT PROTECTED
//
// KEEP AFTER:
//
// /api/v1/logs/stats
// /api/v1/logs/projects/stats
// /api/v1/logs/timeseries
// ==========================================================

app.get(
  "/api/v1/logs/:projectId",
  requireAuth,
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const rawProjectId =
        req.params
          .projectId;

      const projectId =
        Array.isArray(
          rawProjectId
        )
          ? rawProjectId[0]
          : rawProjectId;

      if (
        typeof projectId !==
          "string" ||
        !projectId.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Project ID is required",
          });
      }

      const normalizedProjectId =
        projectId.trim();

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
        (page - 1) *
        limit;

      const filter = {
        projectId:
          normalizedProjectId,
      };

      const [
        logs,
        total,
      ] =
        await Promise.all([
          LogModel.find(
            filter
          )
            .sort({
              timestamp:
                -1,
            })
            .skip(
              skip
            )
            .limit(
              limit
            )
            .lean(),

          LogModel.countDocuments(
            filter
          ),
        ]);

      const totalPages =
        Math.ceil(
          total /
            limit
        );

      return res
        .status(200)
        .json({
          success:
            true,

          projectId:
            normalizedProjectId,

          page,

          limit,

          total,

          totalPages,

          count:
            logs.length,

          hasNextPage:
            page <
            totalPages,

          hasPreviousPage:
            page > 1,

          logs,
        });
    } catch (error) {
      console.error(
        "Project Logs Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch project logs",
        });
    }
  }
);

// ==========================================================
// SOCKET.IO JWT AUTHENTICATION
// ==========================================================

io.use(
  (
    socket,
    next
  ) => {
    try {
      const token =
        socket
          .handshake
          .auth
          ?.token;

      if (
        typeof token !==
          "string" ||
        !token
      ) {
        console.log(
          "❌ Socket connection rejected: no token"
        );

        return next(
          new Error(
            "Authentication required"
          )
        );
      }

      const user =
        verifyToken(
          token
        );

      socket.data.user =
        user;

      console.log(
        "🔐 Socket authenticated:",
        user.userId
      );

      return next();
    } catch (error) {
      console.error(
        "❌ Socket authentication failed:",
        error instanceof Error
          ? error.message
          : error
      );

      return next(
        new Error(
          "Invalid or expired token"
        )
      );
    }
  }
);

// ==========================================================
// SOCKET.IO CONNECTION
//
// Every authenticated socket joins a private user room.
//
// Example:
//
// user:6a886db565536f532e9be767
//
// Webhook events are emitted only to the owner of the event.
// ==========================================================

io.on(
  "connection",
  (
    socket
  ) => {
    console.log(
      `🔌 Socket Connected: ${socket.id}`
    );

    const userId =
      socket.data.user?.userId;

    if (
      typeof userId !==
        "string" ||
      !userId.trim()
    ) {
      console.error(
        "❌ Socket user missing after authentication"
      );

      socket.disconnect(
        true
      );

      return;
    }

    const userRoom =
      `user:${userId}`;

    void socket.join(
      userRoom
    );

    console.log(
      `👤 Socket joined room: ${userRoom}`
    );

    socket.on(
      "disconnect",
      (
        reason
      ) => {
        console.log(
          `🔴 Socket Disconnected: ${socket.id}`
        );

        console.log(
          `Reason: ${reason}`
        );
      }
    );
  }
);

// ==========================================================
// REDIS -> SOCKET.IO REAL-TIME BRIDGE
//
// Worker publishes delivery updates to:
//
// webhook:events
//
// API server subscribes and forwards each update to the
// authenticated owner's Socket.IO room.
// ==========================================================

interface WebhookRealtimeEvent {
  type:
    | "processing"
    | "retrying"
    | "success"
    | "failed";

  eventId:
    string;

  endpointId:
    string;

  projectId:
    string;

  userId:
    string;

  attempt:
    number;

  totalAttempts:
    number;

  statusCode?:
    number | null;

  latencyMs?:
    number | null;

  error?:
    string | null;

  timestamp:
    string;
}

function isWebhookRealtimeEvent(
  value: unknown
): value is WebhookRealtimeEvent {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    return false;
  }

  const event =
    value as Partial<WebhookRealtimeEvent>;

  return (
    (
      event.type ===
        "processing" ||
      event.type ===
        "retrying" ||
      event.type ===
        "success" ||
      event.type ===
        "failed"
    ) &&
    typeof event.eventId ===
      "string" &&
    typeof event.endpointId ===
      "string" &&
    typeof event.projectId ===
      "string" &&
    typeof event.userId ===
      "string" &&
    typeof event.attempt ===
      "number" &&
    typeof event.totalAttempts ===
      "number" &&
    typeof event.timestamp ===
      "string"
  );
}

async function startWebhookRealtimeSubscriber(): Promise<void> {
  try {
    await connectRedisSubscriber();

    await redisSubscriber.subscribe(
      WEBHOOK_EVENTS_CHANNEL,
      (
        message
      ) => {
        try {
          const parsed: unknown =
            JSON.parse(
              message
            );

          if (
            !isWebhookRealtimeEvent(
              parsed
            )
          ) {
            console.error(
              "⚠️ Invalid realtime webhook event received"
            );

            return;
          }

          const userRoom =
            `user:${parsed.userId}`;

          io
            .to(
              userRoom
            )
            .emit(
              "webhook:event",
              parsed
            );

          console.log(
            `📡 Socket webhook event: ${parsed.type}`
          );

          console.log(
            `📨 Event: ${parsed.eventId}`
          );

          console.log(
            `👤 Room: ${userRoom}`
          );
        } catch (error) {
          console.error(
            "⚠️ Invalid Redis webhook event:",
            error instanceof Error
              ? error.message
              : error
          );
        }
      }
    );

    console.log(
      `📥 Redis subscribed: ${WEBHOOK_EVENTS_CHANNEL}`
    );

    console.log(
      "📡 Redis -> Socket.IO realtime bridge ready"
    );
  } catch (error) {
    // Real-time monitoring must not take down the HTTP API.
    console.error(
      "⚠️ Webhook realtime subscriber failed:",
      error instanceof Error
        ? error.message
        : error
    );
  }
}

// ==========================================================
// LOG INGEST VALIDATION
// ==========================================================

const LogIngestSchema =
  z.object({
    projectId:
      z
        .string()
        .min(1),

    level:
      z.enum([
        "info",
        "warn",
        "error",
        "fatal",
      ]),

    message:
      z
        .string()
        .min(1),

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
// PROJECT API KEY PROTECTED
// ==========================================================

app.post(
  "/api/v1/logs",
  requireProjectApiKey,
  async (
    req:
      ProjectAuthenticatedRequest,
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

    // ======================================================
    // VALIDATE BODY
    // ======================================================

    const result =
      LogIngestSchema.safeParse(
        req.body
      );

    if (
      !result.success
    ) {
      console.error(
        "❌ Validation Error:",
        result.error
          .format()
      );

      return res
        .status(400)
        .json({
          success:
            false,

          error:
            result.error
              .format(),
        });
    }

    const {
      projectId,
      level,
      message,
      metadata = {},
    } =
      result.data;

    // ======================================================
    // AUTHENTICATED PROJECT
    // ======================================================

    const authenticatedProjectId =
      req.project
        ?.projectId;

    if (
      !authenticatedProjectId
    ) {
      console.error(
        "❌ Authenticated project missing"
      );

      return res
        .status(401)
        .json({
          success:
            false,

          error:
            "Authenticated project not found",
        });
    }

    // ======================================================
    // VERIFY API KEY BELONGS TO PROJECT
    // ======================================================

    if (
      projectId !==
      authenticatedProjectId
    ) {
      console.error(
        "❌ Project API key mismatch:",
        {
          requested:
            projectId,

          authenticated:
            authenticatedProjectId,
        }
      );

      return res
        .status(403)
        .json({
          success:
            false,

          error:
            "API key does not belong to this project",
        });
    }

    const timestamp =
      new Date();

    // ======================================================
    // CHECK MONGODB
    // ======================================================

    if (
      mongoose
        .connection
        .readyState !==
      1
    ) {
      console.error(
        "❌ MongoDB is not connected"
      );

      return res
        .status(503)
        .json({
          success:
            false,

          error:
            "MongoDB is not connected",
        });
    }

    try {
      // ====================================================
      // SAVE LOG
      // ====================================================

      const savedLog =
        await LogModel.create({
          projectId:
            authenticatedProjectId,

          level,

          message,

          metadata,

          timestamp,
        });

      console.log(
        "✅ MongoDB log saved:",
        savedLog._id
          .toString()
      );

      // ====================================================
      // REDIS STREAM
      // ====================================================

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
                projectId:
                  authenticatedProjectId,

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
        } catch (
          redisError
        ) {
          console.error(
            "⚠️ Redis Stream Error:",
            redisError
          );

          console.log(
            "⚠️ MongoDB save succeeded, continuing without Redis stream."
          );
        }
      } else {
        console.log(
          "⚠️ Redis is not connected. Skipping stream."
        );
      }

      // ====================================================
      // SOCKET.IO
      // ====================================================

      io.emit(
        "log:new",
        {
          _id:
            savedLog._id
              .toString(),

          id:
            savedLog._id
              .toString(),

          eventId:
            entryId,

          projectId:
            authenticatedProjectId,

          level,

          message,

          metadata,

          timestamp:
            timestamp
              .toISOString(),
        }
      );

      console.log(
        "📡 Socket.IO event emitted"
      );

      // ====================================================
      // RESPONSE
      // ====================================================

      console.log(
        "✅ Log ingestion completed successfully"
      );

      console.log(
        "===================================="
      );

      return res
        .status(201)
        .json({
          success:
            true,

          eventId:
            entryId,

          logId:
            savedLog._id
              .toString(),

          projectId:
            authenticatedProjectId,

          message:
            "Log ingested successfully",
        });
    } catch (error) {
      console.error(
        "❌ Ingestion Error:",
        error
      );

      console.log(
        "===================================="
      );

      return res
        .status(500)
        .json({
          success:
            false,

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
  Number(
    process.env.PORT
  ) ||
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

    // ======================================================
    // MONGODB
    // ======================================================

    await connectDB();

    console.log(
      "✅ MongoDB connected"
    );

    console.log(
      "📦 Database:",
      mongoose
        .connection
        .db
        ?.databaseName
    );

    console.log(
      "📋 Collection:",
      LogModel
        .collection
        .name
    );

    // ======================================================
    // REDIS
    // ======================================================

    try {
      await connectRedis();

      console.log(
        "✅ Redis connected"
      );
    } catch (
      redisError
    ) {
      console.error(
        "⚠️ Redis connection failed:",
        redisError
      );

      console.log(
        "⚠️ Continuing without Redis..."
      );
    }

    // ======================================================
    // WEBHOOK REAL-TIME SUBSCRIBER
    // ======================================================

    await startWebhookRealtimeSubscriber();

    // ======================================================
    // HTTP SERVER
    // ======================================================

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
          "📊 Health: /api/health"
        );

        console.log(
          "🔐 Login: /api/v1/auth/login"
        );

        console.log(
          "👤 Current User: /api/v1/users/me"
        );

        console.log(
          "📁 Projects: /api/v1/projects"
        );

        console.log(
          "🔗 Endpoints: /api/v1/endpoints"
        );

        console.log(
          "🚚 Dispatch: POST /api/v1/dispatch"
        );

        console.log(
          "✅ Verified Webhook: POST /api/test/webhook"
        );

        console.log(
          "🔥 Failure Webhook: POST /api/test/webhook/fail"
        );

        console.log(
          "🔐 HMAC SHA-256 verification enabled"
        );

        console.log(
          "🛡️ Webhook replay protection: 5 minutes"
        );

        console.log(
          "🧪 DB Debug: /api/debug/db"
        );

        console.log(
          "📋 Logs: /api/v1/logs"
        );

        console.log(
          "📊 Stats: /api/v1/logs/stats"
        );

        console.log(
          "📈 Time Series: /api/v1/logs/timeseries"
        );

        console.log(
          "📊 Project Stats: /api/v1/logs/projects/stats"
        );

        console.log(
          "🔑 Log ingestion protected by Project API Key"
        );

        console.log(
          "🔐 Socket.IO protected by JWT"
        );

        console.log(
          "📡 Socket.IO Ready"
        );

        console.log(
          `📥 Realtime Redis channel: ${WEBHOOK_EVENTS_CHANNEL}`
        );

        console.log(
          "👤 Webhook events isolated by authenticated user room"
        );

        console.log(
          "💾 MongoDB persistence enabled"
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

    process.exit(
      1
    );
  }
}

void start();

// ==========================================================
// GRACEFUL SHUTDOWN
// ==========================================================

async function shutdown() {
  console.log(
    "🛑 Shutting down LogPulse..."
  );

  try {
    // ======================================================
    // REDIS REAL-TIME SUBSCRIBER
    // ======================================================

    if (
      redisSubscriber.isOpen
    ) {
      try {
        await redisSubscriber.unsubscribe(
          WEBHOOK_EVENTS_CHANNEL
        );

        await redisSubscriber.quit();

        console.log(
          "🔴 Redis webhook subscriber closed"
        );
      } catch (error) {
        console.error(
          "⚠️ Redis subscriber shutdown error:",
          error instanceof Error
            ? error.message
            : error
        );
      }
    }

    // ======================================================
    // MAIN REDIS CLIENT
    // ======================================================

    if (
      redisClient.isOpen
    ) {
      await redisClient.quit();

      console.log(
        "🔴 Redis connection closed"
      );
    }

    // ======================================================
    // MONGODB
    // ======================================================

    await mongoose
      .connection
      .close();

    console.log(
      "🔴 MongoDB connection closed"
    );

    // ======================================================
    // HTTP
    // ======================================================

    server.close(
      () => {
        console.log(
          "🔴 HTTP server closed"
        );

        process.exit(
          0
        );
      }
    );
  } catch (error) {
    console.error(
      "Shutdown Error:",
      error
    );

    process.exit(
      1
    );
  }
}

// ==========================================================
// PROCESS SIGNALS
// ==========================================================

process.on(
  "SIGINT",
  () => {
    void shutdown();
  }
);

process.on(
  "SIGTERM",
  () => {
    void shutdown();
  }
);