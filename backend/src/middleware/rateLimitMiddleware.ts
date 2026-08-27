import {
  NextFunction,
  Response,
} from "express";

import {
  redisClient,
} from "../config/redis";

import {
  type ProjectAuthenticatedRequest,
} from "./apiKeyMiddleware";

// ==========================================================
// DISPATCH RATE LIMIT CONFIGURATION
//
// Defaults:
//
// 100 requests
// per 60 seconds
// per project
//
// Can be overridden from .env for testing/deployment.
// ==========================================================

const DEFAULT_RATE_LIMIT =
  100;

const DEFAULT_WINDOW_SECONDS =
  60;

function getRateLimit(): number {
  const configured =
    Number(
      process.env
        .DISPATCH_RATE_LIMIT
    );

  if (
    Number.isInteger(
      configured
    ) &&
    configured > 0
  ) {
    return configured;
  }

  return DEFAULT_RATE_LIMIT;
}

function getWindowSeconds(): number {
  const configured =
    Number(
      process.env
        .DISPATCH_RATE_WINDOW_SECONDS
    );

  if (
    Number.isInteger(
      configured
    ) &&
    configured > 0
  ) {
    return configured;
  }

  return DEFAULT_WINDOW_SECONDS;
}

// ==========================================================
// PROJECT DISPATCH RATE LIMIT
//
// IMPORTANT:
//
// requireProjectApiKey MUST execute before this middleware
// because we need:
//
// req.project.projectId
//
// Redis key example:
//
// pulse:rate-limit:dispatch:payment-service-v2
// ==========================================================

export async function dispatchRateLimit(
  req: ProjectAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // ======================================================
    // AUTHENTICATED PROJECT
    // ======================================================

    const projectId =
      req.project?.projectId;

    if (!projectId) {
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
    // REDIS MUST BE AVAILABLE
    // ======================================================

    if (
      !redisClient.isReady
    ) {
      console.error(
        "❌ Rate limiter Redis is not ready"
      );

      return res
        .status(503)
        .json({
          success:
            false,

          error:
            "Rate limiter temporarily unavailable",
        });
    }

    // ======================================================
    // CONFIG
    // ======================================================

    const limit =
      getRateLimit();

    const windowSeconds =
      getWindowSeconds();

    // ======================================================
    // REDIS RATE-LIMIT KEY
    //
    // Limit is isolated per project.
    // ======================================================

    const redisKey =
      `pulse:rate-limit:dispatch:${projectId}`;

    // ======================================================
    // INCREMENT REQUEST COUNTER
    // ======================================================

    const currentCount =
      await redisClient.incr(
        redisKey
      );

    // ======================================================
    // FIRST REQUEST STARTS WINDOW
    // ======================================================

    if (
      currentCount === 1
    ) {
      await redisClient.expire(
        redisKey,
        windowSeconds
      );
    }

    // ======================================================
    // TTL
    //
    // Redis normally returns remaining seconds.
    //
    // Defensive fallback is used if TTL is unavailable.
    // ======================================================

    let ttl =
      await redisClient.ttl(
        redisKey
      );

    if (
      ttl < 0
    ) {
      await redisClient.expire(
        redisKey,
        windowSeconds
      );

      ttl =
        windowSeconds;
    }

    // ======================================================
    // RATE-LIMIT VALUES
    // ======================================================

    const remaining =
      Math.max(
        0,
        limit -
          currentCount
      );

    const resetAt =
      Math.floor(
        Date.now() /
          1000
      ) +
      ttl;

    // ======================================================
    // RESPONSE HEADERS
    // ======================================================

    res.setHeader(
      "X-RateLimit-Limit",
      String(
        limit
      )
    );

    res.setHeader(
      "X-RateLimit-Remaining",
      String(
        remaining
      )
    );

    res.setHeader(
      "X-RateLimit-Reset",
      String(
        resetAt
      )
    );

    // ======================================================
    // LIMIT EXCEEDED
    // ======================================================

    if (
      currentCount >
      limit
    ) {
      res.setHeader(
        "Retry-After",
        String(
          Math.max(
            1,
            ttl
          )
        )
      );

      console.warn(
        "===================================="
      );

      console.warn(
        "🚫 Dispatch rate limit exceeded"
      );

      console.warn(
        "Project:",
        projectId
      );

      console.warn(
        "Requests:",
        currentCount
      );

      console.warn(
        "Limit:",
        limit
      );

      console.warn(
        "Reset in:",
        `${ttl}s`
      );

      console.warn(
        "===================================="
      );

      return res
        .status(429)
        .json({
          success:
            false,

          error:
            "Too many dispatch requests",

          rateLimit: {
            limit,

            remaining:
              0,

            resetAt,

            retryAfterSeconds:
              Math.max(
                1,
                ttl
              ),
          },
        });
    }

    // ======================================================
    // REQUEST ALLOWED
    // ======================================================

    return next();
  } catch (error) {
    console.error(
      "Dispatch Rate Limit Error:",
      error
    );

    return res
      .status(503)
      .json({
        success:
          false,

        error:
          "Rate limiter temporarily unavailable",
      });
  }
}
