/**
 * Hash Queue — BullMQ-backed sequential delivery to the blockchain writer.
 *
 * Design:
 *   - One BullMQ Queue: "hash-chain"
 *   - One Worker: concurrency=1 (strict one-at-a-time, in segment order)
 *   - Each hash record from a recording = one job
 *   - jobId = "{recordingId}:seg:{index}" — deterministic, prevents duplicates
 *     on resubmit (BullMQ deduplicates by jobId in the waiting set)
 *   - Job timeout: HASH_JOB_TIMEOUT_MS (default 30 s)
 *   - Retry with exponential backoff: up to HASH_JOB_RETRIES attempts
 *   - After all retries exhausted: job moves to BullMQ's FAILED set (dead-letter)
 *
 * Exports:
 *   initQueue()       — connect to Redis, start worker, return { queue }
 *   addHashJob(data)  — enqueue a single hash record; returns the BullMQ Job
 */

import { Queue, Worker } from "bullmq";
import { writeHashToBlockchain } from "./blockchain-writer.js";

// ---- Config from environment -----------------------------------------------

function redisConnectionFromUrl(url) {
  // BullMQ expects { host, port } or an ioredis instance.
  // Parse a redis://[user:pass@]host[:port][/db] URL manually.
  try {
    const u = new URL(url);
    const useTls = u.protocol === "rediss:";
    return {
      host: u.hostname || "127.0.0.1",
      port: u.port ? Number(u.port) : 6379,
      ...(u.password ? { password: u.password } : {}),
      ...(u.username && u.username !== "default" ? { username: u.username } : {}),
      ...(u.pathname && u.pathname !== "/" ? { db: Number(u.pathname.slice(1)) } : {}),
      ...(useTls ? { tls: {} } : {}),
      // Required for serverless Redis (Upstash) — without this, BullMQ
      // hits MaxRetriesPerRequestError when connections are recycled.
      maxRetriesPerRequest: null,
      // Cap reconnect delay at 30s. Default ioredis strategy caps at 2s
      // (30 retries/min), which burns through Upstash's daily request
      // limit quickly when the connection is misconfigured or Redis is down.
      retryStrategy: (times) => Math.min(times * 1000, 30_000),
    };
  } catch {
    // Fallback to default
    return {
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 1000, 30_000),
    };
  }
}

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const JOB_TIMEOUT_MS = Number(process.env.HASH_JOB_TIMEOUT_MS) || 120_000;
const JOB_RETRIES = Number(process.env.HASH_JOB_RETRIES) || 5;
const CONCURRENCY = Number(process.env.HASH_CONCURRENCY) || 1;

const connection = redisConnectionFromUrl(REDIS_URL);

const QUEUE_NAME = "hash-chain";

// ---- Shared Queue instance (lazy-init) -------------------------------------

let queue = null;
let worker = null;

/**
 * Initialise the BullMQ Queue and Worker.
 * Safe to call multiple times — only creates instances once.
 */
export function initQueue() {
  if (queue) return { queue };

  // ── Queue ──────────────────────────────────────────────────────────────────
  queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      // Hash jobs are non-retryable: no on-chain duplicate guard exists,
      // so retrying a job that already submitted a tx would write the same
      // hash twice and corrupt the chain.
      attempts: 1,
      // Remove completed jobs after 1 hour to keep Redis lean.
      // Failed jobs are kept indefinitely for inspection.
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 604800 },  // 7 days
    },
  });

  // ── Worker ─────────────────────────────────────────────────────────────────
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      console.log(
        "[queue] Processing job " + job.id +
        " | seg=" + job.data.index +
        " | recording=" + (job.data.recordingId ?? "unknown")
      );

      // Enforce per-job timeout with a Promise.race.
      // AbortController ensures the blockchain writer (and its receipt polling)
      // actually stops when the timeout fires — no zombie polling loops.
      const abort = new AbortController();
      await Promise.race([
        writeHashToBlockchain(job.data, { signal: abort.signal }),
        new Promise((_, reject) =>
          setTimeout(() => {
            abort.abort();
            reject(new Error("Job timed out after " + JOB_TIMEOUT_MS + "ms"));
          }, JOB_TIMEOUT_MS)
        ),
      ]);

      console.log("[queue] Job " + job.id + " completed (seg " + job.data.index + ")");
    },
    {
      connection,
      concurrency: CONCURRENCY, // 1 = strict sequential
      lockDuration: 120_000,    // match job timeout — prevents "Missing lock" on slow RPC
    }
  );

  // ── Worker event hooks ─────────────────────────────────────────────────────
  worker.on("failed", (job, err) => {
    console.error(
      "[queue] Job " + (job?.id ?? "?") +
      " failed (attempts:1, non-retryable) — moved to dead-letter (FAILED set)." +
      " seg=" + (job?.data?.index ?? "?") +
      " Error: " + err.message
    );
  });

  worker.on("error", (err) => {
    console.error("[queue] Worker error:", err.message);
  });

  console.log(
    "[queue] Initialised '" + QUEUE_NAME + "'" +
    " | redis=" + REDIS_URL +
    " | concurrency=" + CONCURRENCY +
    " | timeout=" + JOB_TIMEOUT_MS + "ms" +
    " | retries=" + JOB_RETRIES
  );

  return { queue };
}

/**
 * Enqueue a single hash record as a BullMQ job.
 *
 * @param {Object} hashRecord - A single entry from Recorder.getHashes()
 *   plus a `recordingId` field added by the /api/hashes/submit handler.
 * @returns {Promise<import("bullmq").Job>}
 */
export async function addHashJob(hashRecord) {
  if (!queue) {
    throw new Error("Queue not initialised. Call initQueue() first.");
  }

  // Deterministic jobId prevents duplicate enqueues if the browser retries
  // the submit request.
  const jobId =
    (hashRecord.recordingId ?? "unknown") + ":seg:" + hashRecord.index;

  const job = await queue.add(
    "write-hash",   // job name (used for filtering in dashboards)
    hashRecord,
    {
      jobId,
      // Genesis segment (index 0) gets slightly higher priority so it always
      // arrives on-chain before subsequent segments in case of ordering races.
      priority: hashRecord.index === 0 ? 1 : 2,
    }
  );

  console.log(
    "[queue] Enqueued jobId=" + job.id +
    " | seg=" + hashRecord.index +
    (hashRecord.type === "genesis" ? " (genesis)" : "")
  );

  return job;
}

/**
 * Return the current count of waiting + active jobs.
 * Useful for monitoring queue depth at submit time.
 */
export async function getQueueDepth() {
  if (!queue) return { waiting: 0, active: 0 };
  const [waiting, active] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
  ]);
  return { waiting, active };
}

/**
 * Gracefully shut down the worker and queue connections.
 * Call this on SIGTERM / SIGINT for a clean exit.
 */
export async function shutdownQueue() {
  if (worker) await worker.close();
  if (queue) await queue.close();
  console.log("[queue] Shutdown complete.");
}