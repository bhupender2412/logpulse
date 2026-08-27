import dotenv from "dotenv";

import {
  Worker,
  UnrecoverableError,
  type Job,
} from "bullmq";

import IORedis from "ioredis";

import {
  connectDB,
} from "../config/db";

import {
  connectRedisPublisher,
  redisPublisher,
} from "../config/redis";

import {
  EndpointModel,
} from "../models/Endpoint";

import {
  WebhookEventModel,
} from "../models/WebhookEvent";

import {
  WEBHOOK_QUEUE_NAME,
  type WebhookJobData,
} from "../queues/webhookQueue";

import {
  generateWebhookSignature,
} from "../utils/webhookSignature";

dotenv.config();

// ==========================================================
// REDIS URL
// ==========================================================

const REDIS_URL =
  process.env.REDIS_URL ||
  "redis://127.0.0.1:6379";

// ==========================================================
// REAL-TIME WEBHOOK CHANNEL
//
// Worker publishes delivery-state changes here.
//
// Flow:
//
// Webhook Worker
//      ↓
// Redis Pub/Sub
//      ↓
// Express Server
//      ↓
// Socket.IO
//      ↓
// React Dashboard
// ==========================================================

const WEBHOOK_EVENTS_CHANNEL =
  "webhook:events";

// ==========================================================
// BULLMQ REDIS CONNECTION
//
// IMPORTANT:
//
// BullMQ continues using IORedis.
//
// This connection is separate from the node-redis publisher
// used for our real-time Pub/Sub events.
// ==========================================================

const workerConnection =
  new IORedis(
    REDIS_URL,
    {
      maxRetriesPerRequest:
        null,
    }
  );

// ==========================================================
// BULLMQ REDIS EVENTS
// ==========================================================

workerConnection.on(
  "connect",
  () => {
    console.log(
      "🔗 Worker Redis socket connected"
    );
  }
);

workerConnection.on(
  "ready",
  () => {
    console.log(
      "✅ Worker Redis ready"
    );
  }
);

workerConnection.on(
  "error",
  (
    error
  ) => {
    console.error(
      "❌ Worker Redis Error:",
      error.message
    );
  }
);

// ==========================================================
// REAL-TIME EVENT TYPE
// ==========================================================

type WebhookRealtimeEventType =
  | "processing"
  | "retrying"
  | "success"
  | "failed";

interface WebhookRealtimeEvent {
  type:
    WebhookRealtimeEventType;

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

// ==========================================================
// PUBLISH REAL-TIME WEBHOOK EVENT
//
// IMPORTANT:
//
// Real-time monitoring is secondary to actual webhook
// delivery.
//
// If Redis Pub/Sub temporarily fails:
//
// webhook delivery MUST continue.
//
// Therefore publishing errors are logged but not thrown.
// ==========================================================

async function publishWebhookRealtimeEvent(
  event: WebhookRealtimeEvent
): Promise<void> {
  try {
    if (
      !redisPublisher.isOpen
    ) {
      await connectRedisPublisher();
    }

    await redisPublisher.publish(
      WEBHOOK_EVENTS_CHANNEL,
      JSON.stringify(
        event
      )
    );

    console.log(
      `📡 Published realtime webhook event: ${event.type}`
    );

    console.log(
      `📨 Event: ${event.eventId}`
    );
  } catch (error) {
    console.error(
      "⚠️ Realtime webhook publish failed:",
      error instanceof Error
        ? error.message
        : error
    );
  }
}

// ==========================================================
// RESPONSE BODY LIMIT
// ==========================================================

function truncateResponse(
  value: string,
  maxLength = 10000
): string {
  if (
    value.length <=
    maxLength
  ) {
    return value;
  }

  return (
    value.slice(
      0,
      maxLength
    ) +
    "...[truncated]"
  );
}

// ==========================================================
// PROCESS WEBHOOK
// ==========================================================

async function processWebhook(
  job: Job<WebhookJobData>
) {
  const {
    eventId,
    endpointId,
    projectId,
    userId,
  } =
    job.data;

  // ========================================================
  // ATTEMPT INFORMATION
  // ========================================================

  const currentAttempt =
    job.attemptsMade + 1;

  const totalAttempts =
    typeof job.opts.attempts ===
      "number"
      ? job.opts.attempts
      : 1;

  const hasMoreAttempts =
    currentAttempt <
    totalAttempts;

  console.log(
    "===================================="
  );

  console.log(
    `⚙️ Processing webhook job: ${job.id}`
  );

  console.log(
    `📨 Event: ${eventId}`
  );

  console.log(
    `🔗 Endpoint: ${endpointId}`
  );

  console.log(
    `📁 Project: ${projectId}`
  );

  console.log(
    `🔁 Attempt: ${currentAttempt}/${totalAttempts}`
  );

  // ========================================================
  // FIND WEBHOOK EVENT
  // ========================================================

  const webhookEvent =
    await WebhookEventModel.findOne({
      eventId,
      projectId,
    });

  if (!webhookEvent) {
    const errorMessage =
      `Webhook event ${eventId} not found`;

    await publishWebhookRealtimeEvent({
      type:
        "failed",

      eventId,

      endpointId,

      projectId,

      userId,

      attempt:
        currentAttempt,

      totalAttempts,

      statusCode:
        null,

      latencyMs:
        null,

      error:
        errorMessage,

      timestamp:
        new Date()
          .toISOString(),
    });

    throw new UnrecoverableError(
      errorMessage
    );
  }

  // ========================================================
  // FIND ENDPOINT
  //
  // signingSecret is select:false in the model.
  //
  // Worker explicitly requests it because it is required
  // for HMAC SHA-256 signing.
  // ========================================================

  const endpoint =
    await EndpointModel.findOne({
      endpointId,
      projectId,
    }).select(
      "+signingSecret"
    );

  // ========================================================
  // ENDPOINT NOT FOUND
  // ========================================================

  if (!endpoint) {
    const errorMessage =
      "Target endpoint not found";

    await WebhookEventModel.updateOne(
      {
        eventId,
      },
      {
        $set: {
          status:
            "failed",

          attemptCount:
            currentAttempt,

          responseStatus:
            null,

          responseBody:
            null,

          latencyMs:
            null,

          error:
            errorMessage,

          completedAt:
            new Date(),
        },

        $push: {
          attempts: {
            attempt:
              currentAttempt,

            status:
              "failed",

            statusCode:
              null,

            latencyMs:
              null,

            responseBody:
              null,

            error:
              errorMessage,

            timestamp:
              new Date(),
          },
        },
      }
    );

    await publishWebhookRealtimeEvent({
      type:
        "failed",

      eventId,

      endpointId,

      projectId,

      userId,

      attempt:
        currentAttempt,

      totalAttempts,

      statusCode:
        null,

      latencyMs:
        null,

      error:
        errorMessage,

      timestamp:
        new Date()
          .toISOString(),
    });

    // Endpoint no longer exists.
    //
    // Retrying cannot fix this configuration problem.
    throw new UnrecoverableError(
      errorMessage
    );
  }

  // ========================================================
  // ENDPOINT DISABLED
  // ========================================================

  if (!endpoint.active) {
    const errorMessage =
      "Endpoint is disabled";

    await WebhookEventModel.updateOne(
      {
        eventId,
      },
      {
        $set: {
          status:
            "failed",

          attemptCount:
            currentAttempt,

          responseStatus:
            null,

          responseBody:
            null,

          latencyMs:
            null,

          error:
            errorMessage,

          completedAt:
            new Date(),
        },

        $push: {
          attempts: {
            attempt:
              currentAttempt,

            status:
              "failed",

            statusCode:
              null,

            latencyMs:
              null,

            responseBody:
              null,

            error:
              errorMessage,

            timestamp:
              new Date(),
          },
        },
      }
    );

    await publishWebhookRealtimeEvent({
      type:
        "failed",

      eventId,

      endpointId,

      projectId,

      userId,

      attempt:
        currentAttempt,

      totalAttempts,

      statusCode:
        null,

      latencyMs:
        null,

      error:
        errorMessage,

      timestamp:
        new Date()
          .toISOString(),
    });

    throw new UnrecoverableError(
      errorMessage
    );
  }

  // ========================================================
  // SIGNING SECRET
  // ========================================================

  const signingSecret =
    endpoint.signingSecret;

  if (
    typeof signingSecret !==
      "string" ||
    !signingSecret.trim()
  ) {
    const errorMessage =
      "Endpoint signing secret is missing";

    await WebhookEventModel.updateOne(
      {
        eventId,
      },
      {
        $set: {
          status:
            "failed",

          attemptCount:
            currentAttempt,

          responseStatus:
            null,

          responseBody:
            null,

          latencyMs:
            null,

          error:
            errorMessage,

          completedAt:
            new Date(),
        },

        $push: {
          attempts: {
            attempt:
              currentAttempt,

            status:
              "failed",

            statusCode:
              null,

            latencyMs:
              null,

            responseBody:
              null,

            error:
              errorMessage,

            timestamp:
              new Date(),
          },
        },
      }
    );

    await publishWebhookRealtimeEvent({
      type:
        "failed",

      eventId,

      endpointId,

      projectId,

      userId,

      attempt:
        currentAttempt,

      totalAttempts,

      statusCode:
        null,

      latencyMs:
        null,

      error:
        errorMessage,

      timestamp:
        new Date()
          .toISOString(),
    });

    // Unrecoverable configuration error.
    //
    // Do NOT use job.discard().
    throw new UnrecoverableError(
      errorMessage
    );
  }

  // ========================================================
  // MARK PROCESSING
  // ========================================================

  const processingStartedAt =
    new Date();

  await WebhookEventModel.updateOne(
    {
      eventId,
    },
    {
      $set: {
        status:
          "processing",

        processingStartedAt,

        completedAt:
          null,
      },
    }
  );

  // ========================================================
  // REAL-TIME PROCESSING EVENT
  // ========================================================

  await publishWebhookRealtimeEvent({
    type:
      "processing",

    eventId,

    endpointId,

    projectId,

    userId,

    attempt:
      currentAttempt,

    totalAttempts,

    statusCode:
      null,

    latencyMs:
      null,

    error:
      null,

    timestamp:
      processingStartedAt
        .toISOString(),
  });

  // ========================================================
  // CREATE EXACT REQUEST BODY
  //
  // IMPORTANT:
  //
  // HMAC signs the exact string sent over HTTP.
  // ========================================================

  const requestBody =
    JSON.stringify(
      webhookEvent.payload
    );

  // ========================================================
  // WEBHOOK TIMESTAMP
  //
  // Unix timestamp in seconds.
  // ========================================================

  const webhookTimestamp =
    Math.floor(
      Date.now() /
        1000
    ).toString();

  // ========================================================
  // GENERATE HMAC SHA-256 SIGNATURE
  //
  // Signed message:
  //
  // timestamp.payload
  // ========================================================

  const signature =
    generateWebhookSignature(
      requestBody,
      signingSecret,
      webhookTimestamp
    );

  console.log(
    "🔐 Webhook signature generated"
  );

  console.log(
    `🕒 Timestamp: ${webhookTimestamp}`
  );

  // NEVER log signingSecret.

  // ========================================================
  // REQUEST TIMER
  // ========================================================

  const startedAt =
    Date.now();

  let response:
    globalThis.Response;

  try {
    // ======================================================
    // REQUEST TIMEOUT
    // ======================================================

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        10000
      );

    try {
      // ====================================================
      // DELIVER SIGNED WEBHOOK
      // ====================================================

      response =
        await fetch(
          endpoint.targetUrl,
          {
            method:
              endpoint.method,

            headers: {
              "Content-Type":
                "application/json",

              "User-Agent":
                "PulseEngine-Webhook/1.0",

              // --------------------------------------------
              // EVENT METADATA
              // --------------------------------------------

              "X-Pulse-Event-ID":
                eventId,

              "X-Pulse-Attempt":
                String(
                  currentAttempt
                ),

              // --------------------------------------------
              // HMAC SECURITY
              // --------------------------------------------

              "X-Pulse-Timestamp":
                webhookTimestamp,

              "X-Pulse-Signature":
                signature,
            },

            // Must be EXACTLY what was signed.
            body:
              requestBody,

            signal:
              controller.signal,
          }
        );
    } finally {
      clearTimeout(
        timeout
      );
    }
  } catch (error) {
    // ======================================================
    // NETWORK / CONNECTION / TIMEOUT FAILURE
    // ======================================================

    const latencyMs =
      Date.now() -
      startedAt;

    let errorMessage =
      "Webhook request failed";

    if (
      error instanceof Error
    ) {
      if (
        error.name ===
        "AbortError"
      ) {
        errorMessage =
          "Webhook request timed out";
      } else {
        errorMessage =
          error.message;
      }
    }

    const nextStatus =
      hasMoreAttempts
        ? "retrying"
        : "failed";

    const completedAt =
      hasMoreAttempts
        ? null
        : new Date();

    // ======================================================
    // UPDATE MONGODB
    // ======================================================

    await WebhookEventModel.updateOne(
      {
        eventId,
      },
      {
        $set: {
          status:
            nextStatus,

          attemptCount:
            currentAttempt,

          responseStatus:
            null,

          responseBody:
            null,

          latencyMs,

          error:
            errorMessage,

          completedAt,
        },

        $push: {
          attempts: {
            attempt:
              currentAttempt,

            status:
              "failed",

            statusCode:
              null,

            latencyMs,

            responseBody:
              null,

            error:
              errorMessage,

            timestamp:
              new Date(),
          },
        },
      }
    );

    // ======================================================
    // PUBLISH RETRY / FAILURE
    // ======================================================

    await publishWebhookRealtimeEvent({
      type:
        hasMoreAttempts
          ? "retrying"
          : "failed",

      eventId,

      endpointId,

      projectId,

      userId,

      attempt:
        currentAttempt,

      totalAttempts,

      statusCode:
        null,

      latencyMs,

      error:
        errorMessage,

      timestamp:
        new Date()
          .toISOString(),
    });

    console.error(
      `❌ Attempt ${currentAttempt} failed:`,
      errorMessage
    );

    if (
      hasMoreAttempts
    ) {
      console.log(
        `🔁 Retry scheduled. Remaining: ${
          totalAttempts -
          currentAttempt
        }`
      );
    } else {
      console.log(
        "🛑 No retry attempts remaining"
      );
    }

    console.log(
      "===================================="
    );

    // ======================================================
    // THROW TO BULLMQ
    //
    // Normal Error allows configured retries/backoff.
    // ======================================================

    if (
      error instanceof Error
    ) {
      throw error;
    }

    throw new Error(
      errorMessage
    );
  }

  // ========================================================
  // LATENCY
  // ========================================================

  const latencyMs =
    Date.now() -
    startedAt;

  // ========================================================
  // READ RESPONSE BODY
  // ========================================================

  let rawResponseBody =
    "";

  try {
    rawResponseBody =
      await response.text();
  } catch {
    rawResponseBody =
      "";
  }

  const responseBody =
    truncateResponse(
      rawResponseBody
    );

  // ========================================================
  // SUCCESS
  // ========================================================

  if (response.ok) {
    const completedAt =
      new Date();

    await WebhookEventModel.updateOne(
      {
        eventId,
      },
      {
        $set: {
          status:
            "success",

          attemptCount:
            currentAttempt,

          responseStatus:
            response.status,

          responseBody,

          latencyMs,

          error:
            null,

          completedAt,
        },

        $push: {
          attempts: {
            attempt:
              currentAttempt,

            status:
              "success",

            statusCode:
              response.status,

            latencyMs,

            responseBody,

            error:
              null,

            timestamp:
              completedAt,
          },
        },
      }
    );

    // ======================================================
    // REAL-TIME SUCCESS EVENT
    // ======================================================

    await publishWebhookRealtimeEvent({
      type:
        "success",

      eventId,

      endpointId,

      projectId,

      userId,

      attempt:
        currentAttempt,

      totalAttempts,

      statusCode:
        response.status,

      latencyMs,

      error:
        null,

      timestamp:
        completedAt
          .toISOString(),
    });

    console.log(
      "✅ Webhook delivered successfully"
    );

    console.log(
      `🌐 HTTP Status: ${response.status}`
    );

    console.log(
      `⏱️ Latency: ${latencyMs}ms`
    );

    console.log(
      `🔁 Attempts used: ${currentAttempt}/${totalAttempts}`
    );

    console.log(
      "🔐 Signed webhook delivered"
    );

    console.log(
      "📡 Realtime success event published"
    );

    console.log(
      "===================================="
    );

    return {
      eventId,

      endpointId,

      projectId,

      status:
        "success",

      statusCode:
        response.status,

      latencyMs,

      attempt:
        currentAttempt,
    };
  }

  // ========================================================
  // NON-2XX RESPONSE
  // ========================================================

  const errorMessage =
    `Webhook returned HTTP ${response.status}`;

  const nextStatus =
    hasMoreAttempts
      ? "retrying"
      : "failed";

  const completedAt =
    hasMoreAttempts
      ? null
      : new Date();

  // ========================================================
  // UPDATE MONGODB
  // ========================================================

  await WebhookEventModel.updateOne(
    {
      eventId,
    },
    {
      $set: {
        status:
          nextStatus,

        attemptCount:
          currentAttempt,

        responseStatus:
          response.status,

        responseBody,

        latencyMs,

        error:
          errorMessage,

        completedAt,
      },

      $push: {
        attempts: {
          attempt:
            currentAttempt,

          status:
            "failed",

          statusCode:
            response.status,

          latencyMs,

          responseBody,

          error:
            errorMessage,

          timestamp:
            new Date(),
        },
      },
    }
  );

  // ========================================================
  // PUBLISH RETRY / FINAL FAILURE
  // ========================================================

  await publishWebhookRealtimeEvent({
    type:
      hasMoreAttempts
        ? "retrying"
        : "failed",

    eventId,

    endpointId,

    projectId,

    userId,

    attempt:
      currentAttempt,

    totalAttempts,

    statusCode:
      response.status,

    latencyMs,

    error:
      errorMessage,

    timestamp:
      new Date()
        .toISOString(),
  });

  console.error(
    `❌ Attempt ${currentAttempt} returned HTTP ${response.status}`
  );

  if (
    hasMoreAttempts
  ) {
    console.log(
      "🔁 Event status: retrying"
    );

    console.log(
      `📊 Attempts remaining: ${
        totalAttempts -
        currentAttempt
      }`
    );
  } else {
    console.log(
      "🛑 Final webhook attempt failed"
    );

    console.log(
      "❌ Event status: failed"
    );
  }

  console.log(
    "===================================="
  );

  // ========================================================
  // BULLMQ RETRY
  //
  // Normal Error tells BullMQ to apply configured retries
  // and exponential backoff.
  // ========================================================

  throw new Error(
    errorMessage
  );
}

// ==========================================================
// START WORKER
// ==========================================================

async function startWorker() {
  try {
    console.log(
      "===================================="
    );

    console.log(
      "🚀 Starting PulseEngine Webhook Worker..."
    );

    console.log(
      "===================================="
    );

    // ======================================================
    // MONGODB
    // ======================================================

    await connectDB();

    console.log(
      "✅ Worker MongoDB connected"
    );

    // ======================================================
    // REDIS REAL-TIME PUBLISHER
    //
    // Separate from BullMQ's IORedis connection.
    // ======================================================

    await connectRedisPublisher();

    console.log(
      "📡 Worker Redis realtime publisher connected"
    );

    // ======================================================
    // BULLMQ WORKER
    // ======================================================

    const worker =
      new Worker<WebhookJobData>(
        WEBHOOK_QUEUE_NAME,
        processWebhook,
        {
          connection:
            workerConnection,

          concurrency:
            5,
        }
      );

    // ======================================================
    // READY
    // ======================================================

    worker.on(
      "ready",
      () => {
        console.log(
          "✅ Webhook Worker ready"
        );

        console.log(
          `📦 Queue: ${WEBHOOK_QUEUE_NAME}`
        );

        console.log(
          "⚡ Concurrency: 5"
        );

        console.log(
          "🔐 HMAC SHA-256 signing enabled"
        );

        console.log(
          `📡 Realtime channel: ${WEBHOOK_EVENTS_CHANNEL}`
        );

        console.log(
          "===================================="
        );
      }
    );

    // ======================================================
    // COMPLETED
    // ======================================================

    worker.on(
      "completed",
      (
        job
      ) => {
        console.log(
          `✅ BullMQ job completed: ${job.id}`
        );
      }
    );

    // ======================================================
    // FAILED ATTEMPT / FINAL FAILURE
    // ======================================================

    worker.on(
      "failed",
      (
        job,
        error
      ) => {
        if (!job) {
          console.error(
            "❌ Unknown BullMQ job failed:",
            error.message
          );

          return;
        }

        const configuredAttempts =
          typeof job.opts.attempts ===
            "number"
            ? job.opts.attempts
            : 1;

        console.error(
          `❌ BullMQ attempt failed: ${job.id}`
        );

        console.error(
          `Attempt progress: ${job.attemptsMade}/${configuredAttempts}`
        );

        console.error(
          `Reason: ${error.message}`
        );

        // ==================================================
        // UNRECOVERABLE FAILURE
        // ==================================================

        if (
          error instanceof
          UnrecoverableError
        ) {
          console.log(
            "🛑 Unrecoverable failure — retry disabled"
          );

          return;
        }

        // ==================================================
        // RETRY AVAILABLE
        // ==================================================

        if (
          job.attemptsMade <
          configuredAttempts
        ) {
          console.log(
            "🔁 BullMQ retry scheduled"
          );
        } else {
          console.log(
            "🛑 BullMQ retries exhausted"
          );
        }
      }
    );

    // ======================================================
    // WORKER ERROR
    // ======================================================

    worker.on(
      "error",
      (
        error
      ) => {
        console.error(
          "❌ Webhook Worker Error:",
          error
        );
      }
    );

    // ======================================================
    // GRACEFUL SHUTDOWN
    // ======================================================

    let shuttingDown =
      false;

    const shutdown =
      async () => {
        if (
          shuttingDown
        ) {
          return;
        }

        shuttingDown =
          true;

        console.log(
          "🛑 Shutting down Webhook Worker..."
        );

        try {
          // ================================================
          // STOP BULLMQ WORKER
          // ================================================

          await worker.close();

          console.log(
            "🔴 BullMQ worker closed"
          );

          // ================================================
          // CLOSE REAL-TIME REDIS PUBLISHER
          // ================================================

          if (
            redisPublisher.isOpen
          ) {
            await redisPublisher.quit();

            console.log(
              "🔴 Worker Redis publisher closed"
            );
          }

          // ================================================
          // CLOSE BULLMQ REDIS
          // ================================================

          await workerConnection.quit();

          console.log(
            "🔴 Worker BullMQ Redis connection closed"
          );

          console.log(
            "🔴 Webhook Worker stopped"
          );

          process.exit(
            0
          );
        } catch (error) {
          console.error(
            "❌ Worker Shutdown Error:",
            error
          );

          process.exit(
            1
          );
        }
      };

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
  } catch (error) {
    console.error(
      "❌ Worker Startup Error:",
      error
    );

    try {
      if (
        redisPublisher.isOpen
      ) {
        await redisPublisher.quit();
      }
    } catch {
      // Ignore cleanup errors during startup failure.
    }

    try {
      await workerConnection.quit();
    } catch {
      // Ignore cleanup errors during startup failure.
    }

    process.exit(
      1
    );
  }
}

void startWorker();