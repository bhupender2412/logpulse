import dotenv from "dotenv";

import {
  Queue,
} from "bullmq";

import IORedis from "ioredis";

dotenv.config();

// ==========================================================
// QUEUE NAME
// ==========================================================

export const WEBHOOK_QUEUE_NAME =
  "webhook-delivery";

// ==========================================================
// REDIS URL
// ==========================================================

const REDIS_URL =
  process.env.REDIS_URL ||
  "redis://127.0.0.1:6379";

// ==========================================================
// BULLMQ REDIS CONNECTION
//
// BullMQ uses its own Redis connection.
//
// maxRetriesPerRequest MUST be null for BullMQ workers.
// Using it here also keeps this connection compatible
// with the worker we will create later.
// ==========================================================

export const bullmqConnection =
  new IORedis(
    REDIS_URL,
    {
      maxRetriesPerRequest:
        null,

      enableReadyCheck:
        true,
    }
  );

// ==========================================================
// CONNECTION EVENTS
// ==========================================================

bullmqConnection.on(
  "connect",
  () => {
    console.log(
      "🔗 BullMQ Redis socket connected"
    );
  }
);

bullmqConnection.on(
  "ready",
  () => {
    console.log(
      "✅ BullMQ Redis ready"
    );
  }
);

bullmqConnection.on(
  "error",
  (
    error
  ) => {
    console.error(
      "❌ BullMQ Redis Error:",
      error.message
    );
  }
);

// ==========================================================
// WEBHOOK JOB DATA
// ==========================================================

export interface WebhookJobData {
  eventId:
    string;

  endpointId:
    string;

  projectId:
    string;

  userId:
    string;
}

// ==========================================================
// WEBHOOK QUEUE
// ==========================================================

export const webhookQueue =
  new Queue<WebhookJobData>(
    WEBHOOK_QUEUE_NAME,
    {
      connection:
        bullmqConnection,

      defaultJobOptions: {
        // --------------------------------------------------
        // COMPLETED JOB CLEANUP
        // --------------------------------------------------

        removeOnComplete: {
          age:
            60 * 60,

          count:
            1000,
        },

        // --------------------------------------------------
        // FAILED JOB RETENTION
        //
        // Keep failures longer so we can inspect them.
        // --------------------------------------------------

        removeOnFail: {
          age:
            24 *
            60 *
            60,

          count:
            5000,
        },
      },
    }
  );