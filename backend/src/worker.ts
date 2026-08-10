// logpulse/backend/src/worker.ts

import dotenv from "dotenv";
import { createClient } from "redis";

import { connectDB } from "./config/db";
import { LogModel } from "./models/Log";

dotenv.config();

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error("❌ REDIS_URL is not defined in .env");
  process.exit(1);
}

const STREAM_KEY = "logs:stream";
const GROUP_NAME = "mongo_writers";
const CONSUMER_NAME = "worker_node_1";

const BATCH_SIZE = 500;
const BLOCK_TIME = 2000;

// --------------------------------------------------
// Redis Client
// --------------------------------------------------

const redisWorker = createClient({
  url: REDIS_URL,

  socket: {
    reconnectStrategy: (retries) => {
      const delay = Math.min(retries * 500, 5000);

      console.log(
        `🔄 Redis reconnecting... attempt ${retries + 1}, retrying in ${delay}ms`
      );

      return delay;
    },
  },
});

// --------------------------------------------------
// Redis Events
// --------------------------------------------------

redisWorker.on("connect", () => {
  console.log("🔌 Redis socket connected.");
});

redisWorker.on("ready", () => {
  console.log("✅ Redis ready.");
});

redisWorker.on("reconnecting", () => {
  console.log("🔄 Redis reconnecting...");
});

redisWorker.on("end", () => {
  console.log("🔴 Redis connection closed.");
});

redisWorker.on("error", (error) => {
  console.error("❌ Redis Error:", error.message);
});

// --------------------------------------------------
// Redis Connection
// --------------------------------------------------

async function connectRedis(): Promise<void> {
  if (redisWorker.isOpen) {
    return;
  }

  try {
    await redisWorker.connect();

    console.log("✅ Redis Connected successfully.");
  } catch (error) {
    console.error("❌ Failed to connect to Redis.");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    throw error;
  }
}

// --------------------------------------------------
// Consumer Group Initialization
// --------------------------------------------------

async function initializeConsumerGroup(): Promise<void> {
  try {
    await redisWorker.xGroupCreate(
      STREAM_KEY,
      GROUP_NAME,
      "0",
      {
        MKSTREAM: true,
      }
    );

    console.log(
      `✅ Redis Consumer Group created: ${GROUP_NAME}`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    // Redis returns BUSYGROUP when the group already exists.
    if (message.includes("BUSYGROUP")) {
      console.log(
        `ℹ️ Redis Consumer Group already exists: ${GROUP_NAME}`
      );

      return;
    }

    throw error;
  }
}

// --------------------------------------------------
// Process Redis Messages
// --------------------------------------------------

async function processMessages(): Promise<void> {
  while (true) {
    try {
      const response = await redisWorker.xReadGroup(
        GROUP_NAME,
        CONSUMER_NAME,
        [
          {
            key: STREAM_KEY,
            id: ">",
          },
        ],
        {
          COUNT: BATCH_SIZE,
          BLOCK: BLOCK_TIME,
        }
      );

      if (!response || response.length === 0) {
        continue;
      }

      const stream = response[0];

      if (!stream) {
        continue;
      }

      const entries = stream.messages;

      if (!entries || entries.length === 0) {
        continue;
      }

      const bulkOps: Array<{
        insertOne: {
          document: {
            projectId: string;
            level: "info" | "warn" | "error" | "fatal";
            message: string;
            metadata: Record<string, unknown>;
            timestamp: Date;
          };
        };
      }> = [];

      const ackIds: string[] = [];

      // --------------------------------------------------
      // Convert Redis messages → MongoDB documents
      // --------------------------------------------------

      for (const entry of entries) {
        const fields = entry.message;

        try {
          const projectId = fields.projectId;

          const level = fields.level as
            | "info"
            | "warn"
            | "error"
            | "fatal";

          const message = fields.message;

          const timestampValue = fields.timestamp;

          if (!projectId || !level || !message) {
            console.error(
              `⚠️ Invalid Redis message: ${entry.id}`
            );

            continue;
          }

          let metadata: Record<string, unknown> = {};

          if (fields.metadata) {
            try {
              const parsedMetadata = JSON.parse(
                fields.metadata
              );

              if (
                parsedMetadata &&
                typeof parsedMetadata === "object" &&
                !Array.isArray(parsedMetadata)
              ) {
                metadata =
                  parsedMetadata as Record<string, unknown>;
              }
            } catch {
              console.warn(
                `⚠️ Invalid metadata JSON for Redis entry ${entry.id}`
              );
            }
          }

          const timestamp = timestampValue
            ? new Date(Number(timestampValue))
            : new Date();

          bulkOps.push({
            insertOne: {
              document: {
                projectId,
                level,
                message,
                metadata,
                timestamp,
              },
            },
          });

          ackIds.push(entry.id);
        } catch (error) {
          console.error(
            `❌ Failed to prepare Redis entry ${entry.id}:`,
            error
          );
        }
      }

      // --------------------------------------------------
      // MongoDB Bulk Insert
      // --------------------------------------------------

      if (bulkOps.length === 0) {
        continue;
      }

      try {
        await LogModel.bulkWrite(
          bulkOps,
          {
            ordered: false,
          }
        );

        console.log(
          `📦 Flushed ${bulkOps.length} logs to MongoDB.`
        );
      } catch (error) {
        console.error(
          "❌ MongoDB bulk insert failed:",
          error
        );

        // Do NOT acknowledge messages if MongoDB insertion
        // failed. Redis will keep them pending.
        continue;
      }

      // --------------------------------------------------
      // Acknowledge Successfully Processed Messages
      // --------------------------------------------------

      if (ackIds.length > 0) {
        try {
          await redisWorker.xAck(
            STREAM_KEY,
            GROUP_NAME,
            ackIds
          );

          console.log(
            `✅ Acknowledged ${ackIds.length} Redis messages.`
          );
        } catch (error) {
          console.error(
            "❌ Redis XACK failed:",
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "❌ Worker Processing Error:",
        error
      );

      // Prevent a tight error loop.
      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );
    }
  }
}

// --------------------------------------------------
// Graceful Shutdown
// --------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}. Shutting down worker...`);

  try {
    if (redisWorker.isOpen) {
      await redisWorker.quit();
      console.log("✅ Redis connection closed.");
    }
  } catch (error) {
    console.error(
      "❌ Error while closing Redis:",
      error
    );
  }

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// --------------------------------------------------
// Start Worker
// --------------------------------------------------

async function startWorker(): Promise<void> {
  try {
    console.log("\n🚀 Starting LogPulse Worker...");
    console.log("------------------------------------------");

    // MongoDB
    await connectDB();

    // Redis
    await connectRedis();

    // Redis Consumer Group
    await initializeConsumerGroup();

    console.log("------------------------------------------");
    console.log(
      `Worker active: Consuming from ${STREAM_KEY}...`
    );
    console.log(
      `Consumer Group : ${GROUP_NAME}`
    );
    console.log(
      `Consumer       : ${CONSUMER_NAME}`
    );
    console.log(
      `Batch Size     : ${BATCH_SIZE}`
    );
    console.log("------------------------------------------\n");

    // Start consuming
    await processMessages();
  } catch (error) {
    console.error("\n🔥 Worker failed to start.");

    if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

void startWorker();