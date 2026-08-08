// logpulse/backend/src/loadTest.ts

import axios from "axios";

const API_URL = "http://localhost:4000/api/v1/logs";

// Configuration
const TOTAL_REQUESTS = Number(process.env.TOTAL_REQUESTS) || 5000;
const CONCURRENCY = Number(process.env.CONCURRENCY) || 50;

// Typesafe arrays
const logLevels = ["info", "warn", "error", "fatal"] as const;

const services = [
  "auth-service",
  "payment-gateway",
  "user-service",
  "inventory-api",
] as const;

const sampleMessages = [
  "Database connection timeout",
  "User login successful",
  "Failed to process payment charge",
  "JWT validation failed",
  "Rate limit threshold exceeded",
] as const;

// Types
type LogLevel = (typeof logLevels)[number];
type Service = (typeof services)[number];
type Message = (typeof sampleMessages)[number];

interface LogPayload {
  projectId: Service;
  level: LogLevel;
  message: Message;
  metadata: {
    env: string;
    region: string;
    traceId: string;
  };
}

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generatePayload(): LogPayload {
  return {
    projectId: randomItem(services),
    level: randomItem(logLevels),
    message: randomItem(sampleMessages),

    metadata: {
      env: "production",
      region: "us-east-1",
      traceId: crypto.randomUUID(),
    },
  };
}

async function sendRequest(): Promise<void> {
  const payload = generatePayload();

  await axios.post(API_URL, payload, {
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function runLoadTest(): Promise<void> {
  console.log("\n🚀 LogPulse Load Test Started");
  console.log("=========================================");
  console.log(`🎯 Target URL      : ${API_URL}`);
  console.log(`📨 Total Requests  : ${TOTAL_REQUESTS}`);
  console.log(`⚡ Concurrency     : ${CONCURRENCY}`);
  console.log("=========================================\n");

  const startTime = performance.now();

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batchSize = Math.min(
      CONCURRENCY,
      TOTAL_REQUESTS - i
    );

    const batch = Array.from(
      { length: batchSize },
      async () => {
        try {
          await sendRequest();
          completed++;
        } catch (error: any) {
          failed++;

          if (failed <= 10) {
            console.error(
              `❌ Request Failed: ${
                error?.response?.data?.error ||
                error?.message ||
                "Unknown Error"
              }`
            );
          }
        }
      }
    );

    await Promise.all(batch);

    const processed = completed + failed;

    if (
      processed % 500 === 0 ||
      processed === TOTAL_REQUESTS
    ) {
      console.log(
        `📦 Progress: ${processed}/${TOTAL_REQUESTS}`
      );
    }
  }

  const totalTimeMs = performance.now() - startTime;
  const totalTimeSeconds = totalTimeMs / 1000;

  const throughput = (
    completed / totalTimeSeconds
  ).toFixed(2);

  const successRate = (
    (completed / TOTAL_REQUESTS) *
    100
  ).toFixed(2);

  console.log("\n✅ Load Test Completed");
  console.log("=========================================");
  console.log(
    `⏱ Duration        : ${totalTimeSeconds.toFixed(
      2
    )} sec`
  );
  console.log(
    `📨 Total Requests : ${TOTAL_REQUESTS}`
  );
  console.log(
    `✅ Successful     : ${completed}`
  );
  console.log(
    `❌ Failed         : ${failed}`
  );
  console.log(
    `📊 Success Rate   : ${successRate}%`
  );
  console.log(
    `⚡ Throughput     : ${throughput} Req/Sec`
  );
  console.log("=========================================\n");
}

runLoadTest().catch((error) => {
  console.error("🔥 Load Test Crashed");
  console.error(error);
  process.exit(1);
});