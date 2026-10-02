/**
 * queue.js — BullMQ hash queue for the Raspberry Pi blockchain worker.
 *
 * Drains the "pi-hash-chain" queue and writes each hash directly to the
 * Stability blockchain via blockchain-writer.js.
 *
 * Exports:
 *   initQueue()      — connect to Redis, start worker
 *   shutdownQueue()  — graceful close
 */

import "dotenv/config";
import { Queue, Worker, QueueEvents } from "bullmq";
import { writeHashToBlockchain } from "./blockchain-writer.js";

// ── Config ───────────────────────��────────────────────────────────��───────────

function redisConnectionFromUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || "127.0.0.1",
      port: u.port ? Number(u.port) : 6379,
      ...(u.password ? { password: u.password } : {}),
      ...(u.pathname && u.pathname !== "/" ? { db: Number(u.pathname.slice(1)) } : {}),
    };
  } catch {
    return { host: "127.0.0.1", port: 6379 };
  }
}

const REDIS_URL   = process.env.REDIS_URL || "redis://localhost:6379";
const JOB_TIMEOUT = Number(process.env.HASH_JOB_TIMEOUT_MS) || 60_000;
const CONCURRENCY = Number(process.env.HASH_CONCURRENCY) || 1;

const connection = redisConnectionFromUrl(REDIS_URL);
const QUEUE_NAME = "pi-hash-chain";

let queue       = null;
let worker      = null;
let queueEvents = null;

// ── Job processor ────────────────���──────────────────────��─────────────────────

async function processHashJob(job) {
  const { recordingId, index, rollingHex, segHashHex, isFirst, isFinal, subcontractAddress } = job.data;

  if (!subcontractAddress) {
    throw new Error("Missing subcontractAddress in job data (seg=" + index + ")");
  }

  console.log(
    `[worker] seg=${index}` +
    `  hash=${rollingHex.slice(0, 16)}...` +
    `  first=${isFirst}  final=${isFinal}` +
    `  contract=${subcontractAddress.slice(0, 10)}…` +
    `  recording=${recordingId}`
  );

  const { txHash } = await writeHashToBlockchain({
    subcontractAddress,
    index,
    rollingHex,
    segHashHex,
    isFirst,
    isFinal,
  });

  console.log("[worker] seg=" + index + " written to chain | tx=" + txHash);
}

// ── Init ─────────────────────���────────────────────────────────────────────────

export function initQueue() {
  if (queue) return { queue };

  queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 3600 },
      removeOnFail:     { age: 604800 },
    },
  });

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      console.log(
        "[queue] Processing job " + job.id +
        " | seg=" + job.data.index +
        " | recording=" + (job.data.recordingId ?? "unknown")
      );

      await Promise.race([
        processHashJob(job),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Job timed out after " + JOB_TIMEOUT + "ms")),
            JOB_TIMEOUT
          )
        ),
      ]);

      console.log("[queue] Job " + job.id + " done (seg " + job.data.index + ")");
    },
    { connection, concurrency: CONCURRENCY }
  );

  worker.on("failed", (job, err) => {
    console.error(
      "[queue] Job " + (job?.id ?? "?") + " FAILED" +
      " | seg=" + (job?.data?.index ?? "?") +
      " | Error: " + err.message
    );
  });

  worker.on("error", (err) => {
    console.error("[queue] Worker error:", err.message);
  });

  queueEvents = new QueueEvents(QUEUE_NAME, { connection });

  queueEvents.on("completed", ({ jobId }) => {
    console.log("[queue:events] completed jobId=" + jobId);
  });

  queueEvents.on("failed", ({ jobId, failedReason }) => {
    console.error("[queue:events] failed jobId=" + jobId + " reason=" + failedReason);
  });

  console.log(
    "[queue] Initialised '" + QUEUE_NAME + "'" +
    " | redis=" + REDIS_URL +
    " | concurrency=" + CONCURRENCY +
    " | timeout=" + JOB_TIMEOUT + "ms"
  );

  return { queue };
}

// ── Shutdown ──────────────────────────────────────────────────────────────────

export async function shutdownQueue() {
  if (worker)      await worker.close();
  if (queue)       await queue.close();
  if (queueEvents) await queueEvents.close();
  console.log("[queue] Shutdown complete.");
}
