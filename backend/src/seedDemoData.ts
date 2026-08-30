import crypto from "crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  connectDB,
} from "./config/db";

import {
  UserModel,
} from "./models/User";

import {
  ProjectModel,
} from "./models/Project";

import {
  EndpointModel,
} from "./models/Endpoint";

import {
  WebhookEventModel,
} from "./models/WebhookEvent";

import {
  generateApiKey,
  getApiKeyLast4,
  hashApiKey,
} from "./utils/apiKey";

dotenv.config();

// ==========================================================
// DEMO USER
// ==========================================================

const DEMO_EMAIL =
  "demo@pulseengine.dev";

// ==========================================================
// HELPERS
// ==========================================================

function generateEndpointId(): string {
  return `ep_${crypto
    .randomBytes(12)
    .toString("hex")}`;
}

function generateSigningSecret(): string {
  return `whsec_${crypto
    .randomBytes(32)
    .toString("hex")}`;
}

function generateEventId(): string {
  return `evt_${crypto
    .randomBytes(16)
    .toString("hex")}`;
}

function hoursAgo(
  hours: number
): Date {
  return new Date(
    Date.now() -
      hours *
        60 *
        60 *
        1000
  );
}

// ==========================================================
// SEED DEMO DATA
// ==========================================================

async function seedDemoData() {
  try {
    // ======================================================
    // DATABASE
    // ======================================================

    await connectDB();

    // ======================================================
    // FIND DEMO USER
    // ======================================================

    const demoUser =
      await UserModel.findOne({
        email:
          DEMO_EMAIL,
      });

    if (!demoUser) {
      throw new Error(
        "Demo user not found. Run createDemoUser.ts first."
      );
    }

    console.log(
      "Demo user found:",
      demoUser.email
    );

    // ======================================================
    // REMOVE ONLY OLD DEMO DATA
    //
    // IMPORTANT:
    // Admin-owned data is not touched.
    // ======================================================

    await WebhookEventModel.deleteMany({
      createdBy:
        demoUser._id,
    });

    await EndpointModel.deleteMany({
      createdBy:
        demoUser._id,
    });

    await ProjectModel.deleteMany({
      createdBy:
        demoUser._id,
    });

    console.log(
      "Previous demo data cleared"
    );

    // ======================================================
    // PROJECT 1
    // ======================================================

    const paymentApiKey =
      generateApiKey();

    const paymentProject =
      await ProjectModel.create({
        name:
          "Payment Service",

        projectId:
          "demo-payment-service",

        apiKeyHash:
          hashApiKey(
            paymentApiKey
          ),

        apiKeyLast4:
          getApiKeyLast4(
            paymentApiKey
          ),

        createdBy:
          demoUser._id,
      });

    // ======================================================
    // PROJECT 2
    // ======================================================

    const authApiKey =
      generateApiKey();

    const authProject =
      await ProjectModel.create({
        name:
          "Authentication Service",

        projectId:
          "demo-auth-service",

        apiKeyHash:
          hashApiKey(
            authApiKey
          ),

        apiKeyLast4:
          getApiKeyLast4(
            authApiKey
          ),

        createdBy:
          demoUser._id,
      });

    console.log(
      "Demo projects created"
    );

    // ======================================================
    // PAYMENT ENDPOINT
    // ======================================================

    const paymentEndpointId =
      generateEndpointId();

    await EndpointModel.create({
      endpointId:
        paymentEndpointId,

      name:
        "Payment Events",

      projectId:
        paymentProject.projectId,

      targetUrl:
        "https://pulseengine-api.onrender.com/api/test/webhook",

      method:
        "POST",

      maxRetries:
        2,

      signingSecret:
        generateSigningSecret(),

      active:
        true,

      createdBy:
        demoUser._id,
    });

    // ======================================================
    // AUTH ENDPOINT
    // ======================================================

    const authEndpointId =
      generateEndpointId();

    await EndpointModel.create({
      endpointId:
        authEndpointId,

      name:
        "Authentication Events",

      projectId:
        authProject.projectId,

      targetUrl:
        "https://pulseengine-api.onrender.com/api/test/webhook",

      method:
        "POST",

      maxRetries:
        2,

      signingSecret:
        generateSigningSecret(),

      active:
        true,

      createdBy:
        demoUser._id,
    });

    console.log(
      "Demo endpoints created"
    );

    // ======================================================
    // EVENT IDs
    // ======================================================

    const failedPaymentEventId =
      generateEventId();

    const redeliveryEventId =
      generateEventId();

    // ======================================================
    // DEMO EVENTS
    //
    // All events are inside the last 24 hours so the default
    // dashboard range immediately contains useful analytics.
    // ======================================================

    const events = [
      // ----------------------------------------------------
      // PAYMENT SERVICE
      // ----------------------------------------------------

      {
        eventId:
          generateEventId(),

        projectId:
          paymentProject.projectId,

        endpointId:
          paymentEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "payment.completed",

          paymentId:
            "pay_demo_1001",

          amount:
            2499,

          currency:
            "INR",
        },

        status:
          "success",

        attemptCount:
          1,

        attempts: [
          {
            attempt:
              1,

            status:
              "success",

            statusCode:
              200,

            latencyMs:
              182,

            responseBody: {
              received:
                true,
            },

            error:
              null,

            timestamp:
              hoursAgo(
                1
              ),
          },
        ],

        responseStatus:
          200,

        responseBody: {
          received:
            true,
        },

        latencyMs:
          182,

        error:
          null,

        queuedAt:
          hoursAgo(
            1
          ),

        processingStartedAt:
          hoursAgo(
            1
          ),

        completedAt:
          hoursAgo(
            1
          ),

        createdAt:
          hoursAgo(
            1
          ),
      },

      {
        eventId:
          generateEventId(),

        projectId:
          paymentProject.projectId,

        endpointId:
          paymentEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "invoice.generated",

          invoiceId:
            "inv_demo_2001",

          customerId:
            "cus_demo_91",
        },

        status:
          "success",

        attemptCount:
          1,

        attempts: [
          {
            attempt:
              1,

            status:
              "success",

            statusCode:
              200,

            latencyMs:
              216,

            responseBody: {
              received:
                true,
            },

            error:
              null,

            timestamp:
              hoursAgo(
                3
              ),
          },
        ],

        responseStatus:
          200,

        responseBody: {
          received:
            true,
        },

        latencyMs:
          216,

        error:
          null,

        queuedAt:
          hoursAgo(
            3
          ),

        processingStartedAt:
          hoursAgo(
            3
          ),

        completedAt:
          hoursAgo(
            3
          ),

        createdAt:
          hoursAgo(
            3
          ),
      },

      // ----------------------------------------------------
      // RETRY THEN SUCCESS
      //
      // This demonstrates exponential retry history in the
      // payload inspector.
      // ----------------------------------------------------

      {
        eventId:
          generateEventId(),

        projectId:
          paymentProject.projectId,

        endpointId:
          paymentEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "payment.refund.created",

          refundId:
            "ref_demo_3001",

          amount:
            799,
        },

        status:
          "success",

        attemptCount:
          2,

        attempts: [
          {
            attempt:
              1,

            status:
              "failed",

            statusCode:
              503,

            latencyMs:
              91,

            responseBody: {
              error:
                "Service temporarily unavailable",
            },

            error:
              "Webhook returned HTTP 503",

            timestamp:
              hoursAgo(
                5
              ),
          },

          {
            attempt:
              2,

            status:
              "success",

            statusCode:
              200,

            latencyMs:
              164,

            responseBody: {
              received:
                true,
            },

            error:
              null,

            timestamp:
              hoursAgo(
                4.9
              ),
          },
        ],

        responseStatus:
          200,

        responseBody: {
          received:
            true,
        },

        latencyMs:
          164,

        error:
          null,

        queuedAt:
          hoursAgo(
            5
          ),

        processingStartedAt:
          hoursAgo(
            5
          ),

        completedAt:
          hoursAgo(
            4.9
          ),

        createdAt:
          hoursAgo(
            5
          ),
      },

      // ----------------------------------------------------
      // FINAL FAILURE
      // ----------------------------------------------------

      {
        eventId:
          failedPaymentEventId,

        projectId:
          paymentProject.projectId,

        endpointId:
          paymentEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "payment.failed",

          paymentId:
            "pay_demo_failed",

          reason:
            "gateway_timeout",
        },

        status:
          "failed",

        attemptCount:
          3,

        attempts: [
          {
            attempt:
              1,

            status:
              "failed",

            statusCode:
              500,

            latencyMs:
              88,

            responseBody: {
              error:
                "Internal Server Error",
            },

            error:
              "Webhook returned HTTP 500",

            timestamp:
              hoursAgo(
                8
              ),
          },

          {
            attempt:
              2,

            status:
              "failed",

            statusCode:
              500,

            latencyMs:
              102,

            responseBody: {
              error:
                "Internal Server Error",
            },

            error:
              "Webhook returned HTTP 500",

            timestamp:
              hoursAgo(
                7.9
              ),
          },

          {
            attempt:
              3,

            status:
              "failed",

            statusCode:
              503,

            latencyMs:
              119,

            responseBody: {
              error:
                "Service unavailable",
            },

            error:
              "Webhook returned HTTP 503",

            timestamp:
              hoursAgo(
                7.7
              ),
          },
        ],

        responseStatus:
          503,

        responseBody: {
          error:
            "Service unavailable",
        },

        latencyMs:
          119,

        error:
          "Webhook delivery failed after all retry attempts",

        queuedAt:
          hoursAgo(
            8
          ),

        processingStartedAt:
          hoursAgo(
            8
          ),

        completedAt:
          hoursAgo(
            7.7
          ),

        createdAt:
          hoursAgo(
            8
          ),
      },

      // ----------------------------------------------------
      // SUCCESSFUL MANUAL REDELIVERY HISTORY
      // ----------------------------------------------------

      {
        eventId:
          redeliveryEventId,

        projectId:
          paymentProject.projectId,

        endpointId:
          paymentEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "payment.failed",

          paymentId:
            "pay_demo_failed",

          reason:
            "gateway_timeout",
        },

        redeliveryOf:
          failedPaymentEventId,

        status:
          "success",

        attemptCount:
          1,

        attempts: [
          {
            attempt:
              1,

            status:
              "success",

            statusCode:
              200,

            latencyMs:
              173,

            responseBody: {
              received:
                true,

              redelivery:
                true,
            },

            error:
              null,

            timestamp:
              hoursAgo(
                6
              ),
          },
        ],

        responseStatus:
          200,

        responseBody: {
          received:
            true,

          redelivery:
            true,
        },

        latencyMs:
          173,

        error:
          null,

        queuedAt:
          hoursAgo(
            6
          ),

        processingStartedAt:
          hoursAgo(
            6
          ),

        completedAt:
          hoursAgo(
            6
          ),

        createdAt:
          hoursAgo(
            6
          ),
      },

      // ----------------------------------------------------
      // AUTH SERVICE
      // ----------------------------------------------------

      {
        eventId:
          generateEventId(),

        projectId:
          authProject.projectId,

        endpointId:
          authEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "user.login",

          userId:
            "usr_demo_101",

          method:
            "password",
        },

        status:
          "success",

        attemptCount:
          1,

        attempts: [
          {
            attempt:
              1,

            status:
              "success",

            statusCode:
              200,

            latencyMs:
              137,

            responseBody: {
              received:
                true,
            },

            error:
              null,

            timestamp:
              hoursAgo(
                2
              ),
          },
        ],

        responseStatus:
          200,

        responseBody: {
          received:
            true,
        },

        latencyMs:
          137,

        error:
          null,

        queuedAt:
          hoursAgo(
            2
          ),

        processingStartedAt:
          hoursAgo(
            2
          ),

        completedAt:
          hoursAgo(
            2
          ),

        createdAt:
          hoursAgo(
            2
          ),
      },

      {
        eventId:
          generateEventId(),

        projectId:
          authProject.projectId,

        endpointId:
          authEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "password.reset",

          userId:
            "usr_demo_202",

          requestedFrom:
            "203.0.113.42",
        },

        status:
          "success",

        attemptCount:
          1,

        attempts: [
          {
            attempt:
              1,

            status:
              "success",

            statusCode:
              204,

            latencyMs:
              149,

            responseBody:
              null,

            error:
              null,

            timestamp:
              hoursAgo(
                10
              ),
          },
        ],

        responseStatus:
          204,

        responseBody:
          null,

        latencyMs:
          149,

        error:
          null,

        queuedAt:
          hoursAgo(
            10
          ),

        processingStartedAt:
          hoursAgo(
            10
          ),

        completedAt:
          hoursAgo(
            10
          ),

        createdAt:
          hoursAgo(
            10
          ),
      },

      {
        eventId:
          generateEventId(),

        projectId:
          authProject.projectId,

        endpointId:
          authEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "security.alert",

          type:
            "jwt_signature_mismatch",

          ip:
            "203.0.113.195",
        },

        status:
          "failed",

        attemptCount:
          3,

        attempts: [
          {
            attempt:
              1,

            status:
              "failed",

            statusCode:
              502,

            latencyMs:
              75,

            responseBody: {
              error:
                "Bad Gateway",
            },

            error:
              "Webhook returned HTTP 502",

            timestamp:
              hoursAgo(
                13
              ),
          },

          {
            attempt:
              2,

            status:
              "failed",

            statusCode:
              502,

            latencyMs:
              82,

            responseBody: {
              error:
                "Bad Gateway",
            },

            error:
              "Webhook returned HTTP 502",

            timestamp:
              hoursAgo(
                12.9
              ),
          },

          {
            attempt:
              3,

            status:
              "failed",

            statusCode:
              503,

            latencyMs:
              97,

            responseBody: {
              error:
                "Service unavailable",
            },

            error:
              "Webhook returned HTTP 503",

            timestamp:
              hoursAgo(
                12.7
              ),
          },
        ],

        responseStatus:
          503,

        responseBody: {
          error:
            "Service unavailable",
        },

        latencyMs:
          97,

        error:
          "Webhook delivery failed after all retry attempts",

        queuedAt:
          hoursAgo(
            13
          ),

        processingStartedAt:
          hoursAgo(
            13
          ),

        completedAt:
          hoursAgo(
            12.7
          ),

        createdAt:
          hoursAgo(
            13
          ),
      },

      {
        eventId:
          generateEventId(),

        projectId:
          authProject.projectId,

        endpointId:
          authEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "user.registered",

          userId:
            "usr_demo_303",

          plan:
            "starter",
        },

        status:
          "success",

        attemptCount:
          1,

        attempts: [
          {
            attempt:
              1,

            status:
              "success",

            statusCode:
              201,

            latencyMs:
              192,

            responseBody: {
              created:
                true,
            },

            error:
              null,

            timestamp:
              hoursAgo(
                16
              ),
          },
        ],

        responseStatus:
          201,

        responseBody: {
          created:
            true,
        },

        latencyMs:
          192,

        error:
          null,

        queuedAt:
          hoursAgo(
            16
          ),

        processingStartedAt:
          hoursAgo(
            16
          ),

        completedAt:
          hoursAgo(
            16
          ),

        createdAt:
          hoursAgo(
            16
          ),
      },

      {
        eventId:
          generateEventId(),

        projectId:
          paymentProject.projectId,

        endpointId:
          paymentEndpointId,

        createdBy:
          demoUser._id,

        payload: {
          event:
            "subscription.renewed",

          subscriptionId:
            "sub_demo_404",

          amount:
            999,
        },

        status:
          "success",

        attemptCount:
          1,

        attempts: [
          {
            attempt:
              1,

            status:
              "success",

            statusCode:
              200,

            latencyMs:
              231,

            responseBody: {
              received:
                true,
            },

            error:
              null,

            timestamp:
              hoursAgo(
                20
              ),
          },
        ],

        responseStatus:
          200,

        responseBody: {
          received:
            true,
        },

        latencyMs:
          231,

        error:
          null,

        queuedAt:
          hoursAgo(
            20
          ),

        processingStartedAt:
          hoursAgo(
            20
          ),

        completedAt:
          hoursAgo(
            20
          ),

        createdAt:
          hoursAgo(
            20
          ),
      },
    ];

    // ======================================================
    // INSERT EVENTS
    // ======================================================

    await WebhookEventModel.insertMany(
      events
    );

    // ======================================================
    // RESULT
    // ======================================================

    console.log(
      "===================================="
    );

    console.log(
      "Demo data seeded successfully"
    );

    console.log(
      "Projects: 2"
    );

    console.log(
      "Endpoints: 2"
    );

    console.log(
      `Webhook Events: ${events.length}`
    );

    console.log(
      "Successful Events:",
      events.filter(
        (event) =>
          event.status ===
          "success"
      ).length
    );

    console.log(
      "Failed Events:",
      events.filter(
        (event) =>
          event.status ===
          "failed"
      ).length
    );

    console.log(
      "Retry Example: included"
    );

    console.log(
      "Redelivery Example: included"
    );

    console.log(
      "===================================="
    );

    // IMPORTANT:
    //
    // Raw project API keys are intentionally NOT printed.
    // The demo account cannot modify these projects anyway.

    await mongoose.disconnect();

    process.exit(
      0
    );
  } catch (error) {
    console.error(
      "Seed Demo Data Error:",
      error
    );

    await mongoose.disconnect();

    process.exit(
      1
    );
  }
}

void seedDemoData();