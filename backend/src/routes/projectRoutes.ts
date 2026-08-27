import {
  Response,
  Router,
} from "express";

import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware";

import {
  invalidateProjectApiKeyCache,
} from "../middleware/apiKeyMiddleware";

import {
  ProjectModel,
} from "../models/Project";

import {
  generateApiKey,
  getApiKeyLast4,
  hashApiKey,
} from "../utils/apiKey";

const router =
  Router();

// ==========================================================
// NORMALIZE PROJECT ID PARAMETER
// ==========================================================

function normalizeProjectId(
  value: string | string[] | undefined
): string | null {
  const projectId =
    Array.isArray(
      value
    )
      ? value[0]
      : value;

  if (
    typeof projectId !==
      "string" ||
    !projectId.trim()
  ) {
    return null;
  }

  return projectId
    .trim()
    .toLowerCase();
}

// ==========================================================
// CREATE PROJECT
//
// POST /api/v1/projects
//
// JWT PROTECTED
//
// Raw API key is returned only during creation.
// MongoDB stores only its hash.
// ==========================================================

router.post(
  "/",
  requireAuth,
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
      // REQUEST BODY
      // ====================================================

      const {
        name,
        projectId,
      } =
        req.body;

      // ====================================================
      // VALIDATE PROJECT NAME
      // ====================================================

      if (
        typeof name !==
          "string" ||
        !name.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Project name is required",
          });
      }

      // ====================================================
      // VALIDATE PROJECT ID
      // ====================================================

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
        projectId
          .trim()
          .toLowerCase();

      // Examples:
      //
      // payment-service
      // frontend-app
      // api-service

      if (
        !/^[a-z0-9][a-z0-9-_]{2,49}$/.test(
          normalizedProjectId
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Project ID must contain 3-50 lowercase letters, numbers, hyphens or underscores",
          });
      }

      // ====================================================
      // DUPLICATE PROJECT CHECK
      // ====================================================

      const existingProject =
        await ProjectModel.findOne({
          projectId:
            normalizedProjectId,
        });

      if (
        existingProject
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            error:
              "Project ID already exists",
          });
      }

      // ====================================================
      // GENERATE PROJECT API KEY
      // ====================================================

      const apiKey =
        generateApiKey();

      const apiKeyHash =
        hashApiKey(
          apiKey
        );

      // ====================================================
      // CREATE PROJECT
      // ====================================================

      const project =
        await ProjectModel.create({
          name:
            name.trim(),

          projectId:
            normalizedProjectId,

          apiKeyHash,

          apiKeyLast4:
            getApiKeyLast4(
              apiKey
            ),

          createdBy:
            userId,
        });

      // ====================================================
      // RESPONSE
      //
      // Raw API key is shown only once.
      // ====================================================

      return res
        .status(201)
        .json({
          success:
            true,

          project: {
            id:
              project._id.toString(),

            name:
              project.name,

            projectId:
              project.projectId,

            apiKeyLast4:
              project.apiKeyLast4,

            createdAt:
              project.createdAt,
          },

          apiKey,

          warning:
            "Save this API key now. It will not be shown again.",
        });
    } catch (error) {
      console.error(
        "Create Project Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to create project",
        });
    }
  }
);

// ==========================================================
// GET PROJECTS
//
// GET /api/v1/projects
//
// JWT PROTECTED
//
// SECURITY:
//
// apiKeyHash must never be exposed.
// ==========================================================

router.get(
  "/",
  requireAuth,
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
      // FETCH PROJECTS
      // ====================================================

      const projects =
        await ProjectModel.find({
          createdBy:
            userId,
        })
          .select(
            "-apiKeyHash"
          )
          .sort({
            createdAt:
              -1,
          })
          .lean();

      // ====================================================
      // RESPONSE
      // ====================================================

      return res
        .status(200)
        .json({
          success:
            true,

          count:
            projects.length,

          projects,
        });
    } catch (error) {
      console.error(
        "Get Projects Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch projects",
        });
    }
  }
);

// ==========================================================
// ROTATE API KEY
//
// POST /api/v1/projects/:projectId/rotate-key
//
// JWT PROTECTED
//
// SECURITY FLOW:
//
// 1. Find owned project.
// 2. Explicitly select hidden apiKeyHash.
// 3. Save previous hash.
// 4. Generate new API key.
// 5. Save new hash.
// 6. Delete previous Redis cache entry.
// 7. Return new plaintext key once.
// ==========================================================

router.post(
  "/:projectId/rotate-key",
  requireAuth,
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
      // PROJECT ID
      // ====================================================

      const projectId =
        normalizeProjectId(
          req.params.projectId
        );

      if (!projectId) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Project ID is required",
          });
      }

      // ====================================================
      // FIND OWNED PROJECT
      //
      // IMPORTANT:
      //
      // apiKeyHash has select:false in Project schema.
      // Therefore we must explicitly request it.
      // ====================================================

      const project =
        await ProjectModel.findOne({
          projectId,

          createdBy:
            userId,
        }).select(
          "+apiKeyHash"
        );

      if (!project) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Project not found",
          });
      }

      // ====================================================
      // SAVE PREVIOUS HASH
      // ====================================================

      const previousApiKeyHash =
        project.apiKeyHash;

      if (
        typeof previousApiKeyHash !==
          "string" ||
        !previousApiKeyHash
      ) {
        console.error(
          "❌ Previous API key hash missing during rotation"
        );

        return res
          .status(500)
          .json({
            success:
              false,

            error:
              "Failed to read current API key configuration",
          });
      }

      // ====================================================
      // GENERATE NEW API KEY
      // ====================================================

      const apiKey =
        generateApiKey();

      const newApiKeyHash =
        hashApiKey(
          apiKey
        );

      // ====================================================
      // UPDATE PROJECT
      // ====================================================

      project.apiKeyHash =
        newApiKeyHash;

      project.apiKeyLast4 =
        getApiKeyLast4(
          apiKey
        );

      await project.save();

      // ====================================================
      // INVALIDATE PREVIOUS REDIS CACHE ENTRY
      //
      // This makes the old API key invalid immediately.
      // ====================================================

      await invalidateProjectApiKeyCache(
        previousApiKeyHash
      );

      console.log(
        "===================================="
      );

      console.log(
        "🔑 Project API key rotated"
      );

      console.log(
        "Project:",
        project.projectId
      );

      console.log(
        "🧹 Previous API-key Redis cache invalidated"
      );

      console.log(
        "===================================="
      );

      // ====================================================
      // RESPONSE
      //
      // Plaintext key is returned only now.
      // ====================================================

      return res
        .status(200)
        .json({
          success:
            true,

          projectId:
            project.projectId,

          apiKey,

          apiKeyLast4:
            project.apiKeyLast4,

          warning:
            "The previous API key is now invalid. Save this new key now.",
        });
    } catch (error) {
      console.error(
        "Rotate API Key Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to rotate API key",
        });
    }
  }
);

// ==========================================================
// DELETE PROJECT
//
// DELETE /api/v1/projects/:projectId
//
// JWT PROTECTED
//
// SECURITY:
//
// The hidden apiKeyHash must be explicitly selected so its
// Redis cache entry can be invalidated after deletion.
// ==========================================================

router.delete(
  "/:projectId",
  requireAuth,
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
      // PROJECT ID
      // ====================================================

      const projectId =
        normalizeProjectId(
          req.params.projectId
        );

      if (!projectId) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Project ID is required",
          });
      }

      // ====================================================
      // FIND PROJECT
      //
      // IMPORTANT:
      //
      // Explicitly select hidden apiKeyHash.
      // ====================================================

      const project =
        await ProjectModel.findOne({
          projectId,

          createdBy:
            userId,
        }).select(
          "+apiKeyHash"
        );

      if (!project) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Project not found",
          });
      }

      // ====================================================
      // SAVE API KEY HASH BEFORE DELETE
      // ====================================================

      const apiKeyHash =
        project.apiKeyHash;

      // ====================================================
      // DELETE PROJECT
      // ====================================================

      await ProjectModel.deleteOne({
        _id:
          project._id,
      });

      // ====================================================
      // INVALIDATE REDIS CACHE
      // ====================================================

      if (
        typeof apiKeyHash ===
          "string" &&
        apiKeyHash
      ) {
        await invalidateProjectApiKeyCache(
          apiKeyHash
        );
      }

      console.log(
        "===================================="
      );

      console.log(
        "🗑️ Project deleted:",
        project.projectId
      );

      console.log(
        "🧹 Project API-key Redis cache invalidated"
      );

      console.log(
        "===================================="
      );

      // ====================================================
      // RESPONSE
      // ====================================================

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Project deleted successfully",

          projectId:
            project.projectId,
        });
    } catch (error) {
      console.error(
        "Delete Project Error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to delete project",
        });
    }
  }
);

// ==========================================================
// EXPORT
// ==========================================================

export default router;