import crypto from "crypto";

import {
  Response,
  Router,
} from "express";

import { z } from "zod";

import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware";

import {
  requireAdmin,
} from "../middleware/roleMiddleware";

import {
  EndpointModel,
} from "../models/Endpoint";

import {
  ProjectModel,
} from "../models/Project";

const router =
  Router();

// ==========================================================
// CREATE ENDPOINT VALIDATION
// ==========================================================

const CreateEndpointSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        2,
        "Endpoint name must contain at least 2 characters"
      )
      .max(
        100,
        "Endpoint name is too long"
      ),

    projectId: z
      .string()
      .trim()
      .min(
        1,
        "Project ID is required"
      ),

    targetUrl: z
      .string()
      .trim()
      .min(
        1,
        "Target URL is required"
      ),

    method: z
      .enum([
        "POST",
        "PUT",
        "PATCH",
      ])
      .default("POST"),

    maxRetries: z
      .number()
      .int()
      .min(0)
      .max(10)
      .default(3),
  });

// ==========================================================
// UPDATE ENDPOINT VALIDATION
// ==========================================================

const UpdateEndpointSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        2,
        "Endpoint name must contain at least 2 characters"
      )
      .max(
        100,
        "Endpoint name is too long"
      )
      .optional(),

    targetUrl: z
      .string()
      .trim()
      .min(
        1,
        "Target URL is required"
      )
      .optional(),

    method: z
      .enum([
        "POST",
        "PUT",
        "PATCH",
      ])
      .optional(),

    maxRetries: z
      .number()
      .int()
      .min(0)
      .max(10)
      .optional(),

    active: z
      .boolean()
      .optional(),
  });

// ==========================================================
// GENERATE ENDPOINT ID
// ==========================================================

function generateEndpointId(): string {
  return `ep_${crypto
    .randomBytes(12)
    .toString("hex")}`;
}

// ==========================================================
// GENERATE HMAC SIGNING SECRET
// ==========================================================

function generateSigningSecret(): string {
  return `whsec_${crypto
    .randomBytes(32)
    .toString("hex")}`;
}

// ==========================================================
// VALIDATE TARGET URL
// ==========================================================

function isValidTargetUrl(
  value: string
): boolean {
  try {
    const url =
      new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

// ==========================================================
// NORMALIZE ROUTE PARAMETER
// ==========================================================

function normalizeParam(
  value:
    | string
    | string[]
    | undefined
): string | null {
  const normalized =
    Array.isArray(value)
      ? value[0]
      : value;

  if (
    typeof normalized !==
      "string" ||
    !normalized.trim()
  ) {
    return null;
  }

  return normalized.trim();
}

// ==========================================================
// CREATE ENDPOINT
//
// POST /api/v1/endpoints
//
// ADMIN ONLY
//
// Demo users are not allowed to create endpoints.
// ==========================================================

router.post(
  "/",
  requireAuth,
  requireAdmin,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      // ====================================================
      // AUTHENTICATED USER
      // ====================================================

      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      // ====================================================
      // VALIDATE REQUEST
      // ====================================================

      const result =
        CreateEndpointSchema.safeParse(
          req.body
        );

      if (!result.success) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              result.error.format(),
          });
      }

      const {
        name,
        projectId,
        targetUrl,
        method,
        maxRetries,
      } =
        result.data;

      // ====================================================
      // VALIDATE URL
      // ====================================================

      if (
        !isValidTargetUrl(
          targetUrl
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Target URL must be a valid HTTP or HTTPS URL",
          });
      }

      // ====================================================
      // VERIFY PROJECT OWNERSHIP
      // ====================================================

      const project =
        await ProjectModel.findOne({
          projectId,

          createdBy:
            userId,
        });

      if (!project) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Project not found or you do not have access to it",
          });
      }

      // ====================================================
      // GENERATE ENDPOINT CREDENTIALS
      // ====================================================

      const endpointId =
        generateEndpointId();

      const signingSecret =
        generateSigningSecret();

      // ====================================================
      // CREATE ENDPOINT
      // ====================================================

      const endpoint =
        await EndpointModel.create({
          endpointId,

          name,

          projectId:
            project.projectId,

          targetUrl,

          method,

          maxRetries,

          signingSecret,

          active:
            true,

          createdBy:
            userId,
        });

      // ====================================================
      // RESPONSE
      // ====================================================

      return res
        .status(201)
        .json({
          success:
            true,

          endpoint: {
            id:
              endpoint._id.toString(),

            endpointId:
              endpoint.endpointId,

            name:
              endpoint.name,

            projectId:
              endpoint.projectId,

            targetUrl:
              endpoint.targetUrl,

            method:
              endpoint.method,

            maxRetries:
              endpoint.maxRetries,

            active:
              endpoint.active,

            createdAt:
              endpoint.createdAt,
          },

          signingSecret,

          warning:
            "Save this signing secret securely. It will be used to verify webhook signatures.",
        });
    } catch (error) {
      console.error(
        "Create Endpoint Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to create endpoint",
        });
    }
  }
);

// ==========================================================
// GET ALL ENDPOINTS
//
// GET /api/v1/endpoints
//
// AUTHENTICATED USERS
//
// Admin and demo users can view their own endpoints.
// ==========================================================

router.get(
  "/",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      const endpoints =
        await EndpointModel.find({
          createdBy:
            userId,
        })
          .sort({
            createdAt:
              -1,
          })
          .lean();

      return res
        .status(200)
        .json({
          success:
            true,

          count:
            endpoints.length,

          endpoints,
        });
    } catch (error) {
      console.error(
        "Get Endpoints Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch endpoints",
        });
    }
  }
);

// ==========================================================
// GET SINGLE ENDPOINT
//
// GET /api/v1/endpoints/:endpointId
//
// AUTHENTICATED USERS
//
// Admin and demo users can inspect their own endpoints.
// ==========================================================

router.get(
  "/:endpointId",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      const endpointId =
        normalizeParam(
          req.params.endpointId
        );

      if (!endpointId) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Endpoint ID is required",
          });
      }

      const endpoint =
        await EndpointModel.findOne({
          endpointId,

          createdBy:
            userId,
        }).lean();

      if (!endpoint) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Endpoint not found",
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          endpoint,
        });
    } catch (error) {
      console.error(
        "Get Endpoint Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch endpoint",
        });
    }
  }
);

// ==========================================================
// UPDATE ENDPOINT
//
// PATCH /api/v1/endpoints/:endpointId
//
// ADMIN ONLY
//
// Demo users must not be able to modify endpoint URLs,
// retry configuration, HTTP methods or active state.
// ==========================================================

router.patch(
  "/:endpointId",
  requireAuth,
  requireAdmin,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      // ====================================================
      // AUTHENTICATED USER
      // ====================================================

      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      // ====================================================
      // ENDPOINT ID
      // ====================================================

      const endpointId =
        normalizeParam(
          req.params.endpointId
        );

      if (!endpointId) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Endpoint ID is required",
          });
      }

      // ====================================================
      // VALIDATE UPDATE BODY
      // ====================================================

      const result =
        UpdateEndpointSchema.safeParse(
          req.body
        );

      if (!result.success) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              result.error.format(),
          });
      }

      const updates =
        result.data;

      // ====================================================
      // AT LEAST ONE FIELD REQUIRED
      // ====================================================

      if (
        Object.keys(
          updates
        ).length ===
        0
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "At least one field must be provided",
          });
      }

      // ====================================================
      // VALIDATE URL IF PROVIDED
      // ====================================================

      if (
        updates.targetUrl &&
        !isValidTargetUrl(
          updates.targetUrl
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Target URL must be a valid HTTP or HTTPS URL",
          });
      }

      // ====================================================
      // UPDATE ENDPOINT
      // ====================================================

      const endpoint =
        await EndpointModel.findOneAndUpdate(
          {
            endpointId,

            createdBy:
              userId,
          },
          {
            $set:
              updates,
          },
          {
            new:
              true,

            runValidators:
              true,
          }
        ).lean();

      // ====================================================
      // NOT FOUND
      // ====================================================

      if (!endpoint) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Endpoint not found",
          });
      }

      // ====================================================
      // RESPONSE
      // ====================================================

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Endpoint updated successfully",

          endpoint,
        });
    } catch (error) {
      console.error(
        "Update Endpoint Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to update endpoint",
        });
    }
  }
);

// ==========================================================
// DELETE ENDPOINT
//
// DELETE /api/v1/endpoints/:endpointId
//
// ADMIN ONLY
//
// Demo users must not be able to delete endpoints.
// ==========================================================

router.delete(
  "/:endpointId",
  requireAuth,
  requireAdmin,
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      // ====================================================
      // AUTHENTICATED USER
      // ====================================================

      const userId =
        req.user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success:
              false,

            error:
              "Authentication required",
          });
      }

      // ====================================================
      // ENDPOINT ID
      // ====================================================

      const endpointId =
        normalizeParam(
          req.params.endpointId
        );

      if (!endpointId) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Endpoint ID is required",
          });
      }

      // ====================================================
      // DELETE ONLY USER'S OWN ENDPOINT
      // ====================================================

      const endpoint =
        await EndpointModel.findOneAndDelete({
          endpointId,

          createdBy:
            userId,
        });

      // ====================================================
      // NOT FOUND
      // ====================================================

      if (!endpoint) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Endpoint not found",
          });
      }

      // ====================================================
      // RESPONSE
      // ====================================================

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Endpoint deleted successfully",

          endpoint: {
            endpointId:
              endpoint.endpointId,

            name:
              endpoint.name,

            projectId:
              endpoint.projectId,
          },
        });
    } catch (error) {
      console.error(
        "Delete Endpoint Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to delete endpoint",
        });
    }
  }
);

// ==========================================================
// EXPORT ROUTER
// ==========================================================

export default router;