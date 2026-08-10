import dotenv from "dotenv";
import { createClient } from "redis";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error(
    "❌ REDIS_URL is not defined in environment variables"
  );
}

export const redisClient = createClient({
  url: REDIS_URL,
});

redisClient.on("connect", () => {
  console.log("🔌 Redis socket connected.");
});

redisClient.on("ready", () => {
  console.log("✅ Redis ready.");
});

redisClient.on("reconnecting", () => {
  console.log("🔄 Redis reconnecting...");
});

redisClient.on("error", (error) => {
  console.error("❌ Redis Error:", error.message);
});

redisClient.on("end", () => {
  console.log("🔴 Redis connection closed.");
});

export async function connectRedis(): Promise<void> {
  if (redisClient.isOpen) {
    return;
  }

  await redisClient.connect();

  console.log("Redis Connected successfully.");
}