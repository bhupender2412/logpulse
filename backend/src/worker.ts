import { createClient } from 'redis';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { LogModel } from './models/Log';

dotenv.config();

const STREAM_KEY = 'logs:stream';
const GROUP_NAME = 'mongo_writers';
const CONSUMER_NAME = 'worker_node_1';
const BATCH_SIZE = 500;

const redisWorker = createClient({ url: process.env.REDIS_URL });

async function startWorker() {
  await connectDB();
  await redisWorker.connect();

  // Initialize Redis Consumer Group
  try {
    await redisWorker.xGroupCreate(STREAM_KEY, GROUP_NAME, '0', { MKSTREAM: true });
  } catch (e) {
    // Group already exists
  }

  console.log(`Worker active: Consuming from ${STREAM_KEY}...`);

  while (true) {
    try {
      // Read up to BATCH_SIZE items from stream
      const response = await redisWorker.xReadGroup(
        GROUP_NAME,
        CONSUMER_NAME,
        [{ key: STREAM_KEY, id: '>' }],
        { COUNT: BATCH_SIZE, BLOCK: 2000 }
      );

      if (!response || response.length === 0) continue;

      const entries = response[0].messages;
      const bulkOps: any[] = [];
      const ackIds: string[] = [];

      for (const entry of entries) {
        const fields = entry.message;
        bulkOps.push({
          insertOne: {
            document: {
              projectId: fields.projectId,
              level: fields.level,
              message: fields.message,
              metadata: JSON.parse(fields.metadata || '{}'),
              timestamp: new Date(Number(fields.timestamp)),
            },
          },
        });
        ackIds.push(entry.id);
      }

      if (bulkOps.length > 0) {
        // High-throughput MongoDB bulk insert
        await LogModel.bulkWrite(bulkOps, { ordered: false });

        // Acknowledge processed entries in Redis
        await redisWorker.xAck(STREAM_KEY, GROUP_NAME, ackIds);
        console.log(`Flushed ${bulkOps.length} logs to MongoDB.`);
      }
    } catch (err) {
      console.error('Worker Processing Error:', err);
    }
  }
}

startWorker();