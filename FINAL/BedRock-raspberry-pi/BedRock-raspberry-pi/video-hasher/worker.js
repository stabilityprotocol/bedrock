/**
 * worker.js — Pi blockchain worker entry point.
 *
 * Run alongside the Python pipeline:
 *   node worker.js
 *
 * This process:
 *   1. Connects to local Redis
 *   2. Starts a BullMQ worker that drains the "pi-hash-chain" queue
 *   3. For each job, writes the hash to the Stability blockchain
 *   4. Shuts down cleanly on SIGTERM / SIGINT
 */

import "dotenv/config";
import { initQueue, shutdownQueue } from "./queue.js";

console.log("[worker] Starting Pi blockchain worker...");
initQueue();

async function shutdown(signal) {
  console.log(`[worker] ${signal} received — shutting down...`);
  await shutdownQueue();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
