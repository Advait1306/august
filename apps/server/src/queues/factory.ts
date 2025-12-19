import { Queue, ReservedJob, Worker } from "groupmq";
import IORedis from "ioredis";

const redisConnection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Track all workers and queues for graceful shutdown
const workers: Worker[] = [];
const queues: Queue[] = [];

const createQueue = (queueName: string) => {
  const queue = new Queue({
    redis: redisConnection,
    namespace: queueName,
    maxAttempts: 1,
    keepCompleted: 100, // Retain last 100 completed jobs for Bull Board
    keepFailed: 100, // Retain last 100 failed jobs for Bull Board
  });
  queues.push(queue);
  return queue;
};

const createWorker = (
  queue: Queue,
  callback: (job: ReservedJob) => Promise<unknown>
): Worker => {
  const worker = new Worker({
    queue,
    concurrency: 50,
    handler: callback,
  });

  worker.on("failed", (err) => {
    console.log(`🔴 ${queue.name} worker failed`, err);
  });

  worker.on("completed", () => {
    console.log(`🟢 ${queue.name} worker completed`);
  });

  worker.on("graceful-timeout", (job) => {
    console.log(
      `⚠️ ${queue.name} job ${job.id} timed out during graceful shutdown`
    );
  });

  worker.on("closed", () => {
    console.log(`🛑 ${queue.name} worker closed`);
  });

  workers.push(worker);
  return worker;
};

const gracefulShutdown = async (timeoutMs = 30000) => {
  console.log("🛑 Starting graceful shutdown...");

  // Close all workers (waits for in-progress jobs to complete)
  await Promise.all(
    workers.map((worker) =>
      worker.close(timeoutMs).catch((err) => {
        console.error("Error closing worker:", err);
      })
    )
  );

  // Close all queues
  await Promise.all(
    queues.map((queue) =>
      queue.close().catch((err) => {
        console.error("Error closing queue:", err);
      })
    )
  );

  // Close Redis connection
  await redisConnection.quit();

  console.log("✅ Graceful shutdown complete");
};

export { createWorker, createQueue, gracefulShutdown };
