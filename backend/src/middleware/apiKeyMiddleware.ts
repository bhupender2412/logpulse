import {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  ProjectModel,
} from "../models/Project";

import {
  hashApiKey,
} from "../utils/apiKey";

import {
  redisClient,
} from "../config/redis";

// ==========================================================
// API KEY CACHE
//
// We never cache the plaintext API key.
//
// Cache key:
//
// pulse:api-key:<SHA256 HASH>
//
// TTL:
// 5 minutes
// ==========================================================

const API_KEY_CACHE_PREFIX =
  "pulse:api-key:";

const API_KEY_CACHE_TTL_SECONDS =
  5 * 60;

// ==========================================================
// AUTHENTICATED PROJECT
// ==========================================================

export interface AuthenticatedProject {
  id:
    string;

  projectId:
    string;

  name:
    string;

  createdBy:
    string;
}

// ==========================================================
// AUTHENTICATED PROJECT REQUEST
// ==========================================================

export interface ProjectAuthenticatedRequest
  extends Request {
  project?:
    AuthenticatedProject;
}

// ==========================================================
// BUILD API KEY CACHE KEY
// ==========================================================

export function getProjectApiKeyCacheKey(
  apiKeyHash: string
): string {
  return (
    API_KEY_CACHE_PREFIX +
    apiKeyHash
  );
}

// ==========================================================
// INVALIDATE API KEY CACHE
//
// We will use this from the API-key rotation route.
//
// IMPORTANT:
//
// Without invalidation, an old rotated API key could remain
// valid until the Redis TTL expires.
// ==========================================================

export async function invalidateProjectApiKeyCache(
  apiKeyHash: string
): Promise<void> {
  try {
    if (
      !redisClient.isReady
    ) {
      return;
    }

    const cacheKey =
      getProjectApiKeyCacheKey(
        apiKeyHash
      );

    await redisClient.del(
      cacheKey
    );

    console.log(
      "🧹 Project API key cache invalidated"
    );
  } catch (error) {
    console.error(
      "⚠️ API key cache invalidation failed:",
      error instanceof Error
        ? error.message
        : error
    );
  }
}

// ==========================================================
// VALIDATE CACHED PROJECT
// ==========================================================

function isValidCachedProject(
  value: unknown
): value is AuthenticatedProject {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return false;
  }

  const project =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof project.id ===
      "string" &&
    typeof project.projectId ===
      "string" &&
    typeof project.name ===
      "string" &&
    typeof project.createdBy ===
      "string"
  );
}

// ==========================================================
// EXTRACT PROJECT API KEY
//
// Preferred:
//
// X-Pulse-API-Key: lp_live_...
//
// Legacy support:
//
// Authorization: Bearer lp_live_...
// ==========================================================

function extractApiKey(
  req: Request
): string | null {
  // ========================================================
  // PREFERRED HEADER
  // ========================================================

  const pulseApiKey =
    req.header(
      "x-pulse-api-key"
    );

  if (
    typeof pulseApiKey ===
      "string" &&
    pulseApiKey.trim()
  ) {
    return pulseApiKey.trim();
  }

  // ========================================================
  // LEGACY BEARER HEADER
  // ========================================================

  const authorization =
    req.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [
    scheme,
    token,
  ] =
    authorization.split(
      " "
    );

  if (
    scheme !==
      "Bearer" ||
    !token
  ) {
    return null;
  }

  return token.trim();
}

// ==========================================================
// REQUIRE PROJECT API KEY
// ==========================================================

export async function requireProjectApiKey(
  req: ProjectAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // ======================================================
    // READ API KEY
    // ======================================================

    const apiKey =
      extractApiKey(
        req
      );

    if (!apiKey) {
      return res
        .status(401)
        .json({
          success:
            false,

          error:
            "Project API key is required",
        });
    }

    // ======================================================
    // VERIFY PREFIX
    // ======================================================

    if (
      !apiKey.startsWith(
        "lp_live_"
      )
    ) {
      return res
        .status(401)
        .json({
          success:
            false,

          error:
            "Invalid project API key",
        });
    }

    // ======================================================
    // HASH PROVIDED KEY
    //
    // Plaintext key is never stored in Redis or MongoDB.
    // ======================================================

    const apiKeyHash =
      hashApiKey(
        apiKey
      );

    const cacheKey =
      getProjectApiKeyCacheKey(
        apiKeyHash
      );

    // ======================================================
    // 1. CHECK REDIS CACHE
    // ======================================================

    if (
      redisClient.isReady
    ) {
      try {
        const cachedValue =
          await redisClient.get(
            cacheKey
          );

        if (cachedValue) {
          const parsed =
            JSON.parse(
              cachedValue
            ) as unknown;

          if (
            isValidCachedProject(
              parsed
            )
          ) {
            req.project =
              parsed;

            console.log(
              `⚡ API key cache hit: ${parsed.projectId}`
            );

            return next();
          }

          // Invalid cache entry.
          // Remove it and continue with MongoDB.

          await redisClient.del(
            cacheKey
          );
        }
      } catch (cacheError) {
        // Redis cache must not make authentication unavailable.
        //
        // Fall back to MongoDB.

        console.error(
          "⚠️ API key Redis cache read failed:",
          cacheError instanceof Error
            ? cacheError.message
            : cacheError
        );
      }
    }

    // ======================================================
    // 2. CACHE MISS -> MONGODB
    // ======================================================

    const project =
      await ProjectModel.findOne({
        apiKeyHash,
      }).select(
        "_id name projectId createdBy"
      );

    if (!project) {
      return res
        .status(401)
        .json({
          success:
            false,

          error:
            "Invalid project API key",
        });
    }

    // ======================================================
    // NORMALIZE AUTHENTICATED PROJECT
    // ======================================================

    const authenticatedProject:
      AuthenticatedProject = {
        id:
          project._id.toString(),

        projectId:
          project.projectId,

        name:
          project.name,

        createdBy:
          project.createdBy.toString(),
      };

    // ======================================================
    // ATTACH PROJECT TO REQUEST
    // ======================================================

    req.project =
      authenticatedProject;

    // ======================================================
    // 3. WRITE TO REDIS CACHE
    //
    // Failure to cache must NOT fail authentication.
    // ======================================================

    if (
      redisClient.isReady
    ) {
      try {
        await redisClient.set(
          cacheKey,
          JSON.stringify(
            authenticatedProject
          ),
          {
            EX:
              API_KEY_CACHE_TTL_SECONDS,
          }
        );

        console.log(
          `💾 API key cached: ${authenticatedProject.projectId}`
        );
      } catch (cacheError) {
        console.error(
          "⚠️ API key Redis cache write failed:",
          cacheError instanceof Error
            ? cacheError.message
            : cacheError
        );
      }
    }

    // ======================================================
    // AUTHENTICATED
    // ======================================================

    return next();
  } catch (error) {
    console.error(
      "Project API Key Error:",
      error
    );

    return res
      .status(500)
      .json({
        success:
          false,

        error:
          "API key validation failed",
      });
  }
}