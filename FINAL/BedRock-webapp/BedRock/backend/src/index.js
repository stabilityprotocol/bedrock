/**
 * Liveness Proxy Server
 *
 * A lightweight Express server that proxies liveness-detection requests
 * to the Luxand.cloud API. This keeps the API token on the server so
 * it is never exposed in browser-side code.
 *
 * Usage:
 *   1. Copy .env.example to .env and set your LUXAND_API_TOKEN
 *   2. npm install
 *   3. npm run dev        (watch mode)
 *      npm start          (production)
 *
 * Endpoint:
 *   POST /api/luxand/liveness
 *   Body: { "imageBase64": "data:image/jpeg;base64,..." }
 *   Response: Luxand API JSON — { score, result, rectangle }
 */

import express from "express";
import cors from "cors";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Redis from "ioredis";
import multer from "multer";
import {
  RekognitionClient,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
} from "@aws-sdk/client-rekognition";
import { initQueue, addHashJob, shutdownQueue, getQueueDepth } from "./queue.js";
import { createContext } from "./smartcontract/ZgtContextService.js";
import GrandfatherService from "./smartcontract/GrandfatherService.js";
import { awaitReceipt } from "./smartcontract/ReceiptService.js";
import { runStep } from "./smartcontract/RetryLogicService.js";
import { buildProvider, buildSigner, buildContract } from "./smartcontract/ZgtEthersFactory.js";
import { GrandfatherABI, SubcontractABI } from "./smartcontract/abi.js";
import { verifyVideo } from "./verification/verify.js";
import { computeFirstHash, resolveSubcontract } from "./verification/subcontract-resolver.js";

// ---- Load .env manually (no dotenv dependency needed) ----------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding single or double quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} else {
  console.warn("No .env file found at " + envPath);
  console.warn("Copy .env.example to .env and set your LUXAND_API_TOKEN.");
}

// ---- Server-side stores ----------------------------------------------------

/**
 * Deployment metadata helpers — backed by Redis so state survives container
 * restarts and Cloud Run scale-to-zero events.
 *
 * Key schema: deploy:<subcontractAddress>
 * Value:      JSON { deploymentBlock: number, signerEoa: string }
 * TTL:        7 days
 */
const DEPLOY_TTL_SECONDS = 7 * 24 * 60 * 60;

async function setDeployInfo(address, info) {
  await redis.set("deploy:" + address, JSON.stringify(info), "EX", DEPLOY_TTL_SECONDS);
}

async function hasDeployInfo(address) {
  const exists = await redis.exists("deploy:" + address);
  return exists === 1;
}

/**
 * Redis client for verification results.
 * Worker writes to key `verify:<subcontractAddress>` after final hash.
 * GET /api/subcontract/:address/status reads from here.
 */
export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: false,
  maxRetriesPerRequest: null,
  // Cap reconnect delay at 30s. Default ioredis strategy caps at 2s
  // (30 retries/min per connection), which burns through Upstash's daily
  // request limit when the connection is misconfigured or Redis is down.
  retryStrategy: (times) => Math.min(times * 1000, 30_000),
});

redis.on("connect", () => console.log("[redis] Connected"));
redis.on("error", (err) => console.error("[redis] Error:", err.message));

// ---- Network configs --------------------------------------------------------
// Supports two Stability Protocol networks (mainnet, testnet). Requests select
// one via the `X-Network` header; verification reads the chain the video was
// originally recorded on.
const NETWORKS = {};

if (process.env.RPC_URL && process.env.GRANDFATHER_ADDRESS) {
  const mainRpc = process.env.RPC_URL;
  const mainKey = process.env.API_KEY || "";
  NETWORKS.mainnet = {
    label: "Mainnet",
    rpcUrl: mainKey ? `${mainRpc}/zgt/${mainKey}` : mainRpc,
    grandfatherAddress: process.env.GRANDFATHER_ADDRESS,
  };
}

if (process.env.TESTNET_RPC_URL && process.env.TESTNET_GRANDFATHER_ADDRESS) {
  const testRpc = process.env.TESTNET_RPC_URL;
  const testKey = process.env.TESTNET_API_KEY || "";
  NETWORKS.testnet = {
    label: "Testnet",
    rpcUrl: testKey ? `${testRpc}/zgt/${testKey}` : testRpc,
    grandfatherAddress: process.env.TESTNET_GRANDFATHER_ADDRESS,
  };
}

if (!NETWORKS.mainnet && !NETWORKS.testnet) {
  console.error("[network] No RPC_URL or TESTNET_RPC_URL configured. Blockchain features will fail.");
}

const DEFAULT_NETWORK = NETWORKS.testnet ? "testnet" : "mainnet";

function resolveNetwork(headerValue) {
  const key = (headerValue || DEFAULT_NETWORK).toLowerCase();
  if (NETWORKS[key]) return { name: key, ...NETWORKS[key] };
  return { name: DEFAULT_NETWORK, ...NETWORKS[DEFAULT_NETWORK] };
}

console.log(
  "[network] Available: " + Object.keys(NETWORKS).join(", ") +
  " | default: " + DEFAULT_NETWORK
);

// ---- Config ----------------------------------------------------------------
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const API_TOKEN = process.env.LUXAND_API_TOKEN;

if (!API_TOKEN) {
  console.warn(
    "WARNING: LUXAND_API_TOKEN is not set — the /api/luxand/liveness endpoint will be unavailable.\n" +
    "Copy .env.example to .env and add your token if you need liveness detection."
  );
}

// ---- AWS Rekognition Liveness -----------------------------------------------
const awsRegion = process.env.AWS_REGION;
const livenessThreshold = Number(process.env.LIVENESS_THRESHOLD || 90);

const rekognitionClient = awsRegion ? new RekognitionClient({
  region: awsRegion,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}) : null;

if (!rekognitionClient) {
  console.warn(
    "WARNING: AWS_REGION is not set — the /api/liveness/session endpoints will be unavailable.\n" +
    "Copy .env.example to .env and add your AWS credentials for Rekognition liveness."
  );
}

function isTerminalStatus(status) {
  return ["SUCCEEDED", "FAILED", "EXPIRED"].includes(status);
}

function mapAwsError(error) {
  const name = error?.name || "UnknownError";
  const message = error?.message || "Unknown AWS error.";

  if (name === "ValidationException") {
    return {
      statusCode: 400,
      body: {
        error: name,
        message: "Invalid liveness session request or session ID.",
        details: message,
      },
    };
  }

  if (name === "ProvisionedThroughputExceededException" || name === "ThrottlingException") {
    return {
      statusCode: 429,
      body: {
        error: name,
        message: "AWS Rekognition throttled the request. Retry shortly.",
        details: message,
      },
    };
  }

  if (name === "SessionNotFoundException") {
    return {
      statusCode: 404,
      body: {
        error: name,
        message: "The liveness session was not found or has expired.",
        details: message,
      },
    };
  }

  if (name === "AccessDeniedException" || name === "UnrecognizedClientException") {
    return {
      statusCode: 403,
      body: {
        error: name,
        message: "AWS credentials or IAM permissions are invalid for this action.",
        details: message,
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: name,
      message: "AWS Rekognition request failed.",
      details: message,
    },
  };
}

// ---- Express app -----------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Inject resolved network config on every request (from `X-Network` header).
app.use((req, _res, next) => {
  req.networkConfig = resolveNetwork(req.headers["x-network"]);
  next();
});

// List available networks + current default.
app.get("/api/network", (_req, res) => {
  res.json({ networks: Object.keys(NETWORKS), default: DEFAULT_NETWORK });
});

// Multer: accept up to 500MB video files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

/**
 * @deprecated — Replaced by AWS Rekognition FaceLiveness.
 * Kept as fallback. See POST /api/liveness/session for the new AWS flow.
 *
 * POST /api/luxand/liveness
 *
 * Accepts { imageBase64 } (data-URL or raw base64), converts it to a
 * binary Blob, and forwards it to the Luxand.cloud liveness endpoint.
 */
app.post("/api/luxand/liveness", async (req, res) => {
  try {
    if (!API_TOKEN) {
      return res.status(503).json({ error: "LUXAND_API_TOKEN is not configured" });
    }

    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    // Strip the data-URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Build multipart form (Node 18+ native FormData + Blob)
    const formData = new FormData();
    formData.append(
      "photo",
      new Blob([imageBuffer], { type: "image/jpeg" }),
      "face.jpg"
    );

    // Forward to Luxand
    const luxandRes = await fetch("https://api.luxand.cloud/photo/liveness", {
      method: "POST",
      headers: { token: API_TOKEN },
      body: formData,
    });

    if (!luxandRes.ok) {
      const errorText = await luxandRes.text();
      console.error("Luxand API error:", luxandRes.status, errorText);
      return res.status(luxandRes.status).json({
        error: "Luxand API error: " + errorText,
        statusCode: luxandRes.status,
      });
    }

    const result = await luxandRes.json();
    res.json(result);
  } catch (error) {
    console.error("Liveness proxy error:", error);
    res.status(500).json({
      error: "Failed to check liveness: " + error.message,
    });
  }
});

// ---- AWS Rekognition Liveness endpoints ------------------------------------

/**
 * POST /api/liveness/session
 *
 * Creates a new AWS Rekognition FaceLiveness session with
 * FaceMovementAndLightChallenge. Returns { sessionId }.
 */
app.post("/api/liveness/session", async (_req, res) => {
  if (!rekognitionClient) {
    return res.status(503).json({ error: "AWS Rekognition is not configured." });
  }

  try {
    const command = new CreateFaceLivenessSessionCommand({
      Settings: {
        ChallengePreferences: [
          {
            Type: "FaceMovementAndLightChallenge",
          },
        ],
      },
    });

    const response = await rekognitionClient.send(command);
    console.log("[liveness] Session created:", response.SessionId);

    res.json({
      sessionId: response.SessionId,
    });
  } catch (error) {
    console.error("[liveness] Session creation failed:", error.message);
    const mapped = mapAwsError(error);
    res.status(mapped.statusCode).json(mapped.body);
  }
});

/**
 * GET /api/liveness/session/:sessionId/result
 *
 * Fetches the result of a FaceLiveness session. Returns confidence,
 * threshold comparison, and terminal status.
 */
app.get("/api/liveness/session/:sessionId/result", async (req, res) => {
  if (!rekognitionClient) {
    return res.status(503).json({ error: "AWS Rekognition is not configured." });
  }

  try {
    const command = new GetFaceLivenessSessionResultsCommand({
      SessionId: req.params.sessionId,
    });

    const response = await rekognitionClient.send(command);
    const sessionStatus = response.Status || "UNKNOWN";
    const confidence =
      typeof response.Confidence === "number" ? response.Confidence : null;
    const succeeded = sessionStatus === "SUCCEEDED";

    console.log("[liveness] Result for", req.params.sessionId, "→ status:", sessionStatus, "confidence:", confidence, "isLive:", succeeded && confidence !== null ? confidence >= livenessThreshold : null);

    res.json({
      sessionId: req.params.sessionId,
      status: sessionStatus,
      confidence,
      threshold: livenessThreshold,
      isLive: succeeded && confidence !== null ? confidence >= livenessThreshold : null,
      isTerminal: isTerminalStatus(sessionStatus),
      hasReferenceImage: Boolean(response.ReferenceImage),
      hasAuditImages:
        Array.isArray(response.AuditImages) && response.AuditImages.length > 0,
    });
  } catch (error) {
    const mapped = mapAwsError(error);
    res.status(mapped.statusCode).json(mapped.body);
  }
});

// ---- Hash submit endpoint --------------------------------------------------

/**
 * POST /api/hashes/submit
 *
 * Accepts the full hash array produced by Recorder.getHashes() and enqueues
 * each record as an individual BullMQ job for sequential blockchain delivery.
 *
 * Body:
 *   {
 *     recordingId: string,   // unique ID for this recording session
 *     hashes: Array<{        // array from Recorder.getHashes()
 *       index, segHashHex, rollingHex, timestamp,
 *       type?, genesisByteCount?, livenessScore?, livenessResult?
 *     }>
 *   }
 *
 * Response:
 *   { queued: number, jobIds: string[] }
 */
app.post("/api/hashes/submit", async (req, res) => {
  try {
    const { recordingId, subcontractAddress, hashes } = req.body;

    if (!recordingId || typeof recordingId !== "string") {
      return res.status(400).json({ error: "recordingId (string) is required" });
    }

    if (!subcontractAddress || !/^0x[a-fA-F0-9]{40}$/.test(subcontractAddress)) {
      return res.status(400).json({
        error: "subcontractAddress must be a valid 20-byte hex address (0x…)",
      });
    }

    if (!Array.isArray(hashes) || hashes.length === 0) {
      return res.status(400).json({ error: "hashes must be a non-empty array" });
    }

    // Validate each record has the minimum required fields
    for (const record of hashes) {
      if (typeof record.index !== "number" ||
          typeof record.segHashHex !== "string" ||
          typeof record.rollingHex !== "string") {
        return res.status(400).json({
          error: "Each hash record must have: index (number), segHashHex (string), rollingHex (string)",
        });
      }
    }

    // Sort by index to guarantee genesis-first enqueue order
    const sorted = [...hashes].sort((a, b) => a.index - b.index);

    const jobIds = [];
    for (const record of sorted) {
      // deploymentBlock is intentionally excluded — worker reads it from deployInfo
      const job = await addHashJob({ ...record, recordingId, subcontractAddress });
      jobIds.push(job.id);
    }

    const depth = await getQueueDepth();
    console.log(
      "[/api/hashes/submit] recordingId=" + recordingId +
      " | queued=" + jobIds.length + " jobs" +
      " | queueDepth: waiting=" + depth.waiting + " active=" + depth.active +
      (sorted.some(r => r.isFinalHash) ? " | includes FINAL hash" : "")
    );

    res.json({ queued: jobIds.length, jobIds });
  } catch (error) {
    console.error("Hash submit error:", error);
    res.status(500).json({ error: "Failed to enqueue hashes: " + error.message });
  }
});

// ---- Subcontract deploy endpoint -------------------------------------------

/**
 * POST /api/subcontract/deploy
 *
 * Deploys a fresh Subcontract via the Grandfather factory, waits for the
 * receipt, extracts the subcontract address from the SubcontractCreated event,
 * verifies bytecode, and stores deployment metadata server-side.
 *
 * Response:
 *   { subcontractAddress: string, deploymentBlock: number, signerEoa: string }
 */
app.post("/api/subcontract/deploy", async (req, res) => {
  try {
    // Step 1: Build ethers context (provider + signer + grandfather contract)
    const ctx = await runStep("createContext", () => createContext(), { maxRetries: 5 });
    const { provider, signer, grandfatherContract } = ctx;

    // Step 2: Get signer EOA address
    const signerEoa = await runStep("getAddress", () => signer.getAddress(), { maxRetries: 5 });

    // Step 3: Submit createSubcontract transaction
    const { txHash } = await runStep(
      "createSubcontractDirect",
      () => GrandfatherService.createSubcontractDirect(grandfatherContract),
      { maxRetries: 5, retryDelayMs: 2000 }
    );
    console.log("[deploy] createSubcontract tx submitted:", txHash);

    // Step 4: Wait for transaction receipt (mined + status:1)
    const receipt = await runStep(
      "awaitReceipt",
      () => awaitReceipt(provider, txHash, {
        verificationStep: "deploy",
        hashLabel: "createSubcontract",
        timeoutMs: 60000,
      }),
      { maxRetries: 3, retryDelayMs: 3000 }
    );

    // Step 5: Extract subcontract address from SubcontractCreated event logs
    const subcontractAddress = await runStep(
      "extractSubcontractAddress",
      () => GrandfatherService.extractSubcontractAddressFromReceipt(receipt),
      { maxRetries: 5 }
    );

    // Step 6: Verify bytecode is present at the address
    await runStep(
      "verifyBytecode",
      async () => {
        const code = await provider.getCode(subcontractAddress);
        if (!code || code === "0x") {
          throw new Error(`No bytecode at ${subcontractAddress} — deploy may not be confirmed yet`);
        }
      },
      { maxRetries: 5, retryDelayMs: 2000 }
    );

    // Step 7: Store deployment metadata in Redis (persists across restarts)
    const deploymentBlock = Number(receipt.blockNumber);
    await setDeployInfo(subcontractAddress, { deploymentBlock, signerEoa });

    console.log(
      "[deploy] Subcontract deployed: " + subcontractAddress +
      " | block=" + deploymentBlock +
      " | signer=" + signerEoa
    );

    // Step 8: Return deployment info to caller
    res.json({ subcontractAddress, deploymentBlock, signerEoa });
  } catch (error) {
    console.error("[deploy] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ---- Subcontract status endpoint -------------------------------------------

/**
 * GET /api/subcontract/:address/status
 *
 * Returns the verification status for a deployed subcontract.
 *
 * | Condition                             | Response                                      |
 * |---------------------------------------|-----------------------------------------------|
 * | Address not in deployInfo             | 404                                           |
 * | In deployInfo, no Redis key yet       | { status: 'not_started' }                     |
 * | Redis key = pending                   | { status: 'pending' }                         |
 * | Redis key = complete                  | { status: 'complete', summary: { ... } }      |
 * | Redis key = error                     | { status: 'error', message: '...' }           |
 */
app.get("/api/subcontract/:address/status", async (req, res) => {
  const { address } = req.params;

  // Validate address format before querying stores
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid address format" });
  }

  // 404 if we have no record of this subcontract being deployed
  const known = await hasDeployInfo(address);
  if (!known) {
    return res.status(404).json({ error: "Unknown subcontract address" });
  }

  try {
    const raw = await redis.get("verify:" + address);

    // Deployed but no hashes have been submitted (or worker hasn't written pending yet)
    if (!raw) {
      return res.json({ status: "not_started" });
    }

    const parsed = JSON.parse(raw);
    return res.json(parsed);
  } catch (error) {
    console.error("[status] Redis read error:", error.message);
    return res.status(500).json({ error: "Failed to read status: " + error.message });
  }
});

// ---- Video verification endpoint -------------------------------------------

/**
 * POST /api/verify
 *
 * Accepts a video file upload + subcontract address, then:
 *   Phase 1: Re-hashes the video using the same SHA-256 / 4MB-segment algorithm
 *   Phase 2: Reads on-chain hash trail from the Subcontract
 *   Phase 3: Compares final hashes
 *   Phase 4: If tampered, finds the exact divergence segment + approximate second
 *
 * Body (multipart/form-data):
 *   - file: the video file
 *   - subcontractAddress: string (0x-prefixed, 20-byte hex)
 *   - videoDurationSeconds: number (optional, for timestamp estimation)
 */
app.post("/api/verify", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Video file is required (field name: 'file')" });
    }

    let { subcontractAddress, videoDurationSeconds } = req.body;

    // Validate address format if explicitly provided
    if (subcontractAddress && !/^0x[a-fA-F0-9]{40}$/.test(subcontractAddress)) {
      return res.status(400).json({
        error: "subcontractAddress must be a valid 20-byte hex address (0x…)",
      });
    }

    const net = req.networkConfig;
    const grandfatherAddress = net.grandfatherAddress;
    if (!grandfatherAddress) {
      return res.status(500).json({ error: "GRANDFATHER_ADDRESS not configured for network: " + net.name });
    }

    // Build ethers context using the selected network
    const provider = buildProvider({ rpcUrl: net.rpcUrl });
    const signer = buildSigner(provider);
    const grandfatherContract = buildContract(grandfatherAddress, GrandfatherABI, signer);

    // Auto-resolve subcontract address from video's first hash if not provided
    if (!subcontractAddress) {
      try {
        const firstHash = computeFirstHash(req.file.buffer);
        console.log("[verify] Auto-resolving from first hash:", firstHash.substring(0, 16) + "...");
        subcontractAddress = await resolveSubcontract(grandfatherContract, firstHash);
      } catch (hashError) {
        return res.status(400).json({ error: "Could not compute hash from video: " + hashError.message });
      }

      if (!subcontractAddress) {
        return res.status(404).json({
          error: "No matching recording found on-chain for this video.",
          hint: "This can happen if: (1) the video was modified in the very first segment, changing its identity hash, or (2) the recording is still being written to the blockchain. If you just recorded this, wait a minute and try again.",
        });
      }
      console.log("[verify] Resolved subcontract:", subcontractAddress);
    }

    const subcontractContract = buildContract(subcontractAddress, SubcontractABI, signer);

    console.log(
      "[verify] Starting verification | file=" + req.file.originalname +
      " | size=" + req.file.size +
      " | subcontract=" + subcontractAddress
    );

    const result = await verifyVideo(req.file.buffer, {
      subcontract: subcontractContract,
      grandfather: grandfatherContract,
      subcontractAddress,
      videoDurationSeconds: videoDurationSeconds ? Number(videoDurationSeconds) : undefined,
    });

    console.log(
      "[verify] Result: " + (result.verified ? "VERIFIED" : "TAMPERED") +
      " | segments=" + result.totalSegments +
      (result.tampering ? " | divergence at seg " + result.tampering.divergenceSegmentIndex : "")
    );

    res.json(result);
  } catch (error) {
    console.error("[verify] Error:", error.message);

    if (error.message.includes("not an authorized child")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Verification failed: " + error.message });
  }
});

// ---- Serve frontend static files in production ----------------------------
const frontendDist = resolve(__dirname, "../../frontend/dist");

if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback — serve index.html for any non-API route
  app.get("*", (_req, res) => {
    res.sendFile(resolve(frontendDist, "index.html"));
  });
  console.log("[static] Serving frontend from", frontendDist);
}

// ---- Start -----------------------------------------------------------------
const server = app.listen(PORT, async () => {
  initQueue();
  try {
    const pong = await redis.ping();
    console.log("[redis] Startup ping: " + pong);
  } catch (err) {
    console.error("[redis] Startup ping failed:", err.message);
  }
  console.log("Liveness proxy running on http://localhost:" + PORT);
});

// ---- Graceful shutdown -----------------------------------------------------
async function shutdown(signal) {
  console.log("\nReceived " + signal + " — shutting down gracefully…");
  server.close(async () => {
    await shutdownQueue();
    await redis.quit();
    process.exit(0);
  });
  // Force exit if graceful shutdown takes too long
  setTimeout(() => process.exit(1), 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
