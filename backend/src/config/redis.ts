import dotenv from "dotenv";

import {
  createClient,
} from "redis";

dotenv.config();

// ==========================================================
// REDIS URL
// ==========================================================

const REDIS_URL =
  process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error(
    "❌ REDIS_URL is not defined in environment variables"
  );
}

// ==========================================================
// MAIN REDIS CLIENT
//
// Used by:
//
// health checks
// Redis streams
// normal Redis commands
// ==========================================================

export const redisClient =
  createClient({
    url:
      REDIS_URL,
  });

// ==========================================================
// REDIS PUB/SUB CLIENTS
//
// IMPORTANT:
//
// A Redis connection that enters subscriber mode should not
// be reused for normal Redis commands.
//
// Therefore:
//
// redisClient      -> normal Redis commands
// redisPublisher   -> publishes real-time events
// redisSubscriber  -> subscribes to real-time events
// ==========================================================

export const redisPublisher =
  redisClient.duplicate();

export const redisSubscriber =
  redisClient.duplicate();

// ==========================================================
// MAIN REDIS EVENTS
// ==========================================================

redisClient.on(
  "connect",
  () => {
    console.log(
      "🔌 Redis socket connected."
    );
  }
);

redisClient.on(
  "ready",
  () => {
    console.log(
      "✅ Redis ready."
    );
  }
);

redisClient.on(
  "reconnecting",
  () => {
    console.log(
      "🔄 Redis reconnecting..."
    );
  }
);

redisClient.on(
  "error",
  (
    error
  ) => {
    console.error(
      "❌ Redis Error:",
      error instanceof Error
        ? error.message
        : error
    );
  }
);

redisClient.on(
  "end",
  () => {
    console.log(
      "🔴 Redis connection closed."
    );
  }
);

// ==========================================================
// REDIS PUBLISHER EVENTS
// ==========================================================

redisPublisher.on(
  "connect",
  () => {
    console.log(
      "📤 Redis publisher socket connected."
    );
  }
);

redisPublisher.on(
  "ready",
  () => {
    console.log(
      "✅ Redis publisher ready."
    );
  }
);

redisPublisher.on(
  "reconnecting",
  () => {
    console.log(
      "🔄 Redis publisher reconnecting..."
    );
  }
);

redisPublisher.on(
  "error",
  (
    error
  ) => {
    console.error(
      "❌ Redis Publisher Error:",
      error instanceof Error
        ? error.message
        : error
    );
  }
);

redisPublisher.on(
  "end",
  () => {
    console.log(
      "🔴 Redis publisher connection closed."
    );
  }
);

// ==========================================================
// REDIS SUBSCRIBER EVENTS
// ==========================================================

redisSubscriber.on(
  "connect",
  () => {
    console.log(
      "📥 Redis subscriber socket connected."
    );
  }
);

redisSubscriber.on(
  "ready",
  () => {
    console.log(
      "✅ Redis subscriber ready."
    );
  }
);

redisSubscriber.on(
  "reconnecting",
  () => {
    console.log(
      "🔄 Redis subscriber reconnecting..."
    );
  }
);

redisSubscriber.on(
  "error",
  (
    error
  ) => {
    console.error(
      "❌ Redis Subscriber Error:",
      error instanceof Error
        ? error.message
        : error
    );
  }
);

redisSubscriber.on(
  "end",
  () => {
    console.log(
      "🔴 Redis subscriber connection closed."
    );
  }
);

// ==========================================================
// CONNECT MAIN REDIS CLIENT
// ==========================================================

export async function connectRedis(): Promise<void> {
  if (
    redisClient.isOpen
  ) {
    return;
  }

  await redisClient.connect();

  console.log(
    "Redis Connected successfully."
  );
}

// ==========================================================
// CONNECT REDIS PUBLISHER
// ==========================================================

export async function connectRedisPublisher(): Promise<void> {
  if (
    redisPublisher.isOpen
  ) {
    return;
  }

  await redisPublisher.connect();

  console.log(
    "✅ Redis publisher connected successfully."
  );
}

// ==========================================================
// CONNECT REDIS SUBSCRIBER
// ==========================================================

export async function connectRedisSubscriber(): Promise<void> {
  if (
    redisSubscriber.isOpen
  ) {
    return;
  }

  await redisSubscriber.connect();

  console.log(
    "✅ Redis subscriber connected successfully."
  );
}

// ==========================================================
// CONNECT ALL REDIS CLIENTS
//
// We will mainly use this inside the API server.
//
// Worker does NOT need the subscriber.
// ==========================================================

export async function connectRedisPubSub(): Promise<void> {
  await Promise.all([
    connectRedisPublisher(),
    connectRedisSubscriber(),
  ]);

  console.log(
    "📡 Redis Pub/Sub ready."
  );
}

// ==========================================================
// CLOSE REDIS PUB/SUB
// ==========================================================

export async function closeRedisPubSub(): Promise<void> {
  if (
    redisSubscriber.isOpen
  ) {
    await redisSubscriber.quit();

    console.log(
      "🔴 Redis subscriber closed."
    );
  }

  if (
    redisPublisher.isOpen
  ) {
    await redisPublisher.quit();

    console.log(
      "🔴 Redis publisher closed."
    );
  }
}