import crypto from "crypto";

import {
  dispatchRateLimit,
} from "../middleware/rateLimitMiddleware";

import {
  Response,
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  requireProjectApiKey,
  type ProjectAuthenticatedRequest,
} from "../middleware/apiKeyMiddleware";

import {
  EndpointModel,
} from "../models/Endpoint";

import {
  WebhookEventModel,
} from "../models/WebhookEvent";

import {
  webhookQueue,
} from "../queues/webhookQueue";

const router =
  Router();

// ==========================================================
// DISPATCH VALIDATION
// ==========================================================

const DispatchSchema =
  z.object({
    endpointId: z
      .string()
      .trim()
      .min(
        1,
        "Endpoint ID is required"
      ),

    payload: z
      .record(
        z.string(),
        z.unknown()
      ),
  });

// ==========================================================
// GENERATE EVENT ID
// ==========================================================

function generateEventId(): string {
  return `evt_${crypto
    .randomBytes(16)
    .toString("hex")}`;
}

// ==========================================================
// DISPATCH WEBHOOK
//
// POST /api/v1/dispatch
//
// PROJECT API KEY PROTECTED
//
// Preferred:
//
// X-Pulse-API-Key: lp_live_...
// ==========================================================

router.post(
  "/",
  requireProjectApiKey,
  dispatchRateLimit,
  async (
    req: ProjectAuthenticatedRequest,
    res: Response
  ) => {
    try {
      // ====================================================
      // 1. AUTHENTICATED PROJECT
      // ====================================================

      const authenticatedProject =
        req.project;

      if (!authenticatedProject) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authenticated project not found",
          });
      }

      // ====================================================
      // 2. VALIDATE REQUEST BODY
      // ====================================================

      const result =
        DispatchSchema.safeParse(
          req.body
        );

      if (!result.success) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              result.error.format(),
          });
      }

      const {
        endpointId,
        payload,
      } =
        result.data;

      // ====================================================
      // 3. FIND TARGET ENDPOINT
      //
      // The endpoint must belong to the project associated
      // with the supplied API key.
      // ====================================================

      const endpoint =
        await EndpointModel.findOne({
          endpointId,

          projectId:
            authenticatedProject.projectId,
        }).lean();

      if (!endpoint) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Endpoint not found for this project",
          });
      }

      // ====================================================
      // 4. CHECK ENDPOINT STATUS
      // ====================================================

      if (!endpoint.active) {
        return res
          .status(409)
          .json({
            success: false,

            error:
              "Endpoint is disabled",
          });
      }

      // ====================================================
      // 5. RETRY CONFIGURATION
      //
      // maxRetries means retries AFTER the original attempt.
      //
      // Example:
      //
      // maxRetries = 3
      //
      // attempt 1 = original
      // attempt 2 = retry 1
      // attempt 3 = retry 2
      // attempt 4 = retry 3
      //
      // BullMQ therefore needs:
      //
      // attempts = maxRetries + 1
      // ====================================================

      const maxRetries =
        typeof endpoint.maxRetries ===
        "number"
          ? endpoint.maxRetries
          : 3;

      const totalAttempts =
        maxRetries + 1;

      // ====================================================
      // 6. CREATE EVENT ID
      // ====================================================

      const eventId =
        generateEventId();

      // ====================================================
      // 7. CREATE DURABLE EVENT IN MONGODB
      //
      // MongoDB is our source of truth.
      // Redis only transports the job.
      // ====================================================

      const webhookEvent =
        await WebhookEventModel.create({
          eventId,

          projectId:
            authenticatedProject.projectId,

          endpointId:
            endpoint.endpointId,

          createdBy:
            authenticatedProject.createdBy,

          payload,

          status:
            "queued",

          attemptCount:
            0,

          attempts:
            [],

          responseStatus:
            null,

          responseBody:
            null,

          latencyMs:
            null,

          error:
            null,

          queuedAt:
            new Date(),

          processingStartedAt:
            null,

          completedAt:
            null,
        });

      // ====================================================
      // 8. ADD BULLMQ JOB
      // ====================================================

      try {
        const job =
          await webhookQueue.add(
            "deliver-webhook",

            {
              eventId:
                webhookEvent.eventId,

              endpointId:
                webhookEvent.endpointId,

              projectId:
                webhookEvent.projectId,

              userId:
                authenticatedProject.createdBy,
            },

            {
              // ------------------------------------------------
              // TRACEABILITY
              //
              // BullMQ job ID = public event ID.
              // ------------------------------------------------

              jobId:
                webhookEvent.eventId,

              // ------------------------------------------------
              // RETRIES
              //
              // Original delivery + configured retries.
              // ------------------------------------------------

              attempts:
                totalAttempts,

              // ------------------------------------------------
              // EXPONENTIAL BACKOFF
              //
              // Approximate retry timing:
              //
              // Retry 1 → 5 seconds
              // Retry 2 → 10 seconds
              // Retry 3 → 20 seconds
              // Retry 4 → 40 seconds
              // Retry 5 → 80 seconds
              //
              // Later we can replace this with an exact custom
              // 5s → 15s → 45s retry strategy.
              // ------------------------------------------------

              backoff: {
                type:
                  "exponential",

                delay:
                  5000,
              },
            }
          );

        // ==================================================
        // 9. ACCEPTED RESPONSE
        //
        // 202 is intentional because delivery happens
        // asynchronously in the worker.
        // ==================================================

        return res
          .status(202)
          .json({
            success: true,

            eventId:
              webhookEvent.eventId,

            jobId:
              job.id,

            projectId:
              webhookEvent.projectId,

            endpointId:
              webhookEvent.endpointId,

            status:
              "queued",

            retryPolicy: {
              maxRetries,

              totalAttempts,

              backoff:
                "exponential",

              initialDelayMs:
                5000,
            },

            message:
              "Webhook accepted for delivery",
          });
      } catch (queueError) {
        // ==================================================
        // 10. QUEUE FAILURE
        //
        // MongoDB event already exists.
        // Mark it failed rather than leaving it permanently
        // in queued state.
        // ==================================================

        console.error(
          "Queue Dispatch Error:",
          queueError
        );

        await WebhookEventModel.updateOne(
          {
            eventId:
              webhookEvent.eventId,
          },
          {
            $set: {
              status:
                "failed",

              error:
                "Failed to enqueue webhook",

              completedAt:
                new Date(),
            },
          }
        );

        return res
          .status(503)
          .json({
            success: false,

            eventId:
              webhookEvent.eventId,

            error:
              "Webhook queue is temporarily unavailable",
          });
      }
    } catch (error) {
      // ====================================================
      // UNEXPECTED ERROR
      // ====================================================

      console.error(
        "Dispatch Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to dispatch webhook",
        });
    }
  }
);

// ==========================================================
// EXPORT
// ==========================================================

export default router;