# Fix Redis Request Storm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent ioredis reconnection storms from burning through Upstash's 500K daily request limit.

**Architecture:** Two targeted changes to ioredis connection configs — cap the retry delay at 30s (instead of the default 2s max) and remove the `QueueEvents` connection that is used only for debug logging. Together these cut worst-case retry rate by ~95%.

**Tech Stack:** Node.js, ioredis, BullMQ, Upstash Redis (TLS)

---

## Root Cause

When the wrong Redis port (6380 instead of 6379) was deployed, every ioredis connection failed with `ETIMEDOUT`. ioredis's default `retryStrategy` backs off at `Math.min(times * 50, 2000)` ms — capping at **one retry every 2 seconds per connection**.

BullMQ's `initQueue()` creates **3 Redis connections** (Queue + Worker + QueueEvents), plus the main `redis` client in `index.js` is a **4th connection**. All four were retrying every ~2 seconds around the clock (`min-instances=1`):

```
4 connections × 30 retries/min × 60 min × ~70 hrs = ~504,000 requests → limit hit
```

Each failed TCP connection attempt that reaches Upstash's servers counts as a billable request.

## Fix

| Change | File | Effect |
|--------|------|--------|
| Cap retry delay at 30s (`retryStrategy`) | `backend/src/queue.js` | Reduces retry rate from 30/min to 2/min per BullMQ connection |
| Cap retry delay at 30s | `backend/src/index.js` | Same for the main Redis client |
| Remove `QueueEvents` | `backend/src/queue.js` | Eliminates 1 entire Redis connection (monitoring only, not needed) |

**Worst-case after fix:** 3 connections × 2 retries/min × 60 × 24 = 8,640 requests/day from retries — 98% below the 500K limit.

---

## Critical Files

| File | Change |
|------|--------|
| `backend/src/queue.js` | Add `retryStrategy` to connection config; remove `QueueEvents` block |
| `backend/src/index.js` | Add `retryStrategy` to main Redis client constructor |

---

## Task 1: Add retry strategy to the BullMQ connection config and remove QueueEvents

**Files:**
- Modify: `backend/src/queue.js:24-45` (connection builder) and `~:128-144` (QueueEvents block)

- [ ] **Step 1: Add `retryStrategy` to `redisConnectionFromUrl`**

In `backend/src/queue.js`, find the `return` inside `redisConnectionFromUrl`:

```js
// BEFORE (lines ~32-44):
return {
  host: u.hostname || "127.0.0.1",
  port: u.port ? Number(u.port) : 6379,
  ...(u.password ? { password: u.password } : {}),
  ...(u.username && u.username !== "default" ? { username: u.username } : {}),
  ...(u.pathname && u.pathname !== "/" ? { db: Number(u.pathname.slice(1)) } : {}),
  ...(useTls ? { tls: {} } : {}),
  maxRetriesPerRequest: null,
};
```

Replace with:

```js
// AFTER — retryStrategy caps reconnect delay at 30s to prevent request storms
return {
  host: u.hostname || "127.0.0.1",
  port: u.port ? Number(u.port) : 6379,
  ...(u.password ? { password: u.password } : {}),
  ...(u.username && u.username !== "default" ? { username: u.username } : {}),
  ...(u.pathname && u.pathname !== "/" ? { db: Number(u.pathname.slice(1)) } : {}),
  ...(useTls ? { tls: {} } : {}),
  maxRetriesPerRequest: null,
  // Exponential back-off capped at 30s. Prevents retry storms (e.g. wrong port)
  // from burning through Upstash's daily request limit.
  // Default ioredis strategy caps at 2s → up to 30 retries/min; this caps at 2/min.
  retryStrategy: (times) => Math.min(times * 1000, 30_000),
};
```

Also update the **fallback** return (the `catch` block, a few lines below):

```js
// BEFORE:
return { host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null };

// AFTER:
return {
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 1000, 30_000),
};
```

- [ ] **Step 2: Remove the QueueEvents block from `initQueue()`**

Find and delete these lines in `backend/src/queue.js` (the entire QueueEvents section):

```js
// DELETE everything from here:
queueEvents = new QueueEvents(QUEUE_NAME, { connection });

queueEvents.on("completed", ({ jobId }) => {
  console.log("[queue:events] completed jobId=" + jobId);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error("[queue:events] failed jobId=" + jobId + " reason=" + failedReason);
});
// DELETE to here.
```

- [ ] **Step 3: Remove the `queueEvents` variable declaration and its shutdown call**

At the top of the module-level vars section, delete:
```js
let queueEvents = null;  // DELETE this line
```

In `shutdownQueue()`, delete:
```js
if (queueEvents) await queueEvents.close();  // DELETE this line
```

- [ ] **Step 4: Remove `QueueEvents` from the BullMQ import**

```js
// BEFORE:
import { Queue, Worker, QueueEvents } from "bullmq";

// AFTER:
import { Queue, Worker } from "bullmq";
```

---

## Task 2: Add retry strategy to the main Redis client in index.js

**Files:**
- Modify: `backend/src/index.js` (~line 93)

- [ ] **Step 1: Add `retryStrategy` to the `new Redis(...)` call**

Find:
```js
export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: false,
  maxRetriesPerRequest: null,
});
```

Replace with:
```js
export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: false,
  maxRetriesPerRequest: null,
  // Cap reconnect delay at 30s to prevent request storms from burning Upstash quota.
  retryStrategy: (times) => Math.min(times * 1000, 30_000),
});
```

---

## Task 3: Rebuild and redeploy, then update REDIS_URL

**Files:**
- No code changes — rebuild + Cloud Run env var update only.

- [ ] **Step 1: Submit Cloud Build**

```bash
gcloud builds submit --config cloudbuild.yaml . --project bedrock-491015
```

Expected: `STATUS: SUCCESS` with a new image digest printed.

- [ ] **Step 2: Update REDIS_URL env var on the Cloud Run service**

```bash
gcloud run services update bedrock-app \
  --update-env-vars "REDIS_URL=rediss://default:<NEW_TOKEN>@relevant-piranha-38899.upstash.io:6379" \
  --project bedrock-491015 \
  --region asia-south1
```

Replace `<NEW_TOKEN>` with the token from the new Upstash database.

Expected: `Done. Service [bedrock-app] revision [bedrock-app-XXXXX] has been deployed and is serving 100 percent of traffic.`

- [ ] **Step 3: Verify Redis connects cleanly**

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="bedrock-app"' \
  --project bedrock-491015 --limit 10 --format "value(textPayload)" --order=desc
```

Expected output includes:
```
[redis] Connected
[redis] Startup ping: PONG
[queue] Initialised 'hash-chain' | redis=rediss://...
```

Must NOT see `connect ETIMEDOUT` or `max requests limit exceeded`.
