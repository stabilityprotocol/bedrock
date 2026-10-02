/**
 * Recording + Hashing module — MediaRecorder pipeline with liveness-gated rolling hash chain.
 * IIFE wrapper and window.* globals removed; converted to ES module named exports.
 *
 * Pipeline:
 *
 *   ┌─────────┐     ┌──────────────────┐
 *   │ Camera  │────▸│ MediaRecorder     │
 *   │ + Mic   │     │ (WebM via MediaRecorder) │
 *   └─────────┘     └────────┬─────────┘
 *                             │
 *          ┌──────────────────┴──────────────────────┐
 *          │            ondataavailable               │
 *          │                                          │
 *          │  Phase: LIVENESS_PENDING                 │
 *          │    → bytes fed into 1.25 MB hasher       │
 *          │    → hash records buffered (not emitted) │
 *          │    → liveness check runs in parallel     │
 *          │    → on PASS: release buffered records   │
 *          │    → on FAIL: stop + discard everything  │
 *          │                                          │
 *          │  Phase: LIVE_HASHING                     │
 *          │    → bytes fed into 1.25 MB hasher       │
 *          │    → hash records emitted immediately    │
 *          └──────────────────────────────────────────┘
 *
 * Genesis segment (index 0):
 *   The FIRST 4 MB of the recording (zero-padded if shorter) is the
 *   genesis block.  It is hashed exactly like every other segment and
 *   its hash seeds the rolling chain: roll_0 = SHA-256(segHash_0).
 *   Liveness metadata is attached to the genesis hash record once the
 *   liveness check completes.
 */
"use strict";

import { toHex, sha256Bytes, rollingUpdate } from './hashing.js';

// ---- Phase constants ------------------------------------------------------
const PHASE_IDLE             = "IDLE";
const PHASE_LIVENESS_PENDING = "LIVENESS_PENDING";
const PHASE_LIVE_HASHING     = "LIVE_HASHING";
const PHASE_STOPPED          = "STOPPED";

// ---- Internal state -------------------------------------------------------
let opts  = null;
let phase = PHASE_IDLE;

let cameraStream      = null;
let cameraReadyPromise = null;   // dedup in-flight requestCamera()
let recorder           = null;

let recordedBlobs  = [];   // all Blob chunks for final MP4 assembly
let outputBlobUrl  = null;
let outputMimeType = null;

// Liveness result — set once the check completes (pass or fail).
// Attached to the genesis (index-0) hash record.
let livenessData = null;   // { score, result } | null

// Hash records produced while liveness check is still in-flight are held
// here.  They are flushed to storeHash() when liveness passes, or discarded
// if liveness fails.
let pendingHashRecords = [];

// Live hashing / segmentation
// Segment size must be just slightly larger than (bitrate × mean chain write time) so
// each segment finishes filling just after the previous one is written to the chain.
// MacBook 720p: ~0.325 MB/s bitrate, mean write = 2.5s → 0.325 × 2.75s ≈ 0.894 MB.
// Must match backend SEG_SIZE_BYTES in .env.
const DEFAULT_SEG_SIZE    = Number(import.meta.env.VITE_SEG_SIZE_BYTES) || 1_310_720;
const DEFAULT_TIMESLICE_MS = 250;              // ms
let SEG_SIZE      = DEFAULT_SEG_SIZE;
let segmentParts  = [];
let segmentLen    = 0;
let segIndex      = 0;     // 0 = first segment (genesis), 1+ = normal
let rolling       = null;  // rolling hash state (Uint8Array or null)
let totalEncodedBytes = 0;
let hashTimesMs   = [];

// Hash record store — all committed segment hashes for this recording.
// Each entry: { index, segHashHex, rollingHex, timestamp,
//               type?, livenessScore?, livenessResult? }
let hashRecords = [];

// Serial processing queue — ensures ondataavailable chunks are hashed
// in exactly the same byte order as they appear in the final file.
let chunkQueue = Promise.resolve();

// ---- Helpers --------------------------------------------------------------

function resetRun() {
  phase = PHASE_IDLE;

  recordedBlobs      = [];
  segmentParts       = [];
  segmentLen         = 0;
  segIndex           = 0;
  rolling            = null;
  totalEncodedBytes  = 0;
  hashTimesMs        = [];
  hashRecords        = [];
  livenessData       = null;
  pendingHashRecords = [];
  chunkQueue         = Promise.resolve();

  if (opts?.onTimingSummary) opts.onTimingSummary(hashTimesMs);
  if (opts?.onLogReplace)   opts.onLogReplace("-");
  if (opts?.onFinalHash)    opts.onFinalHash("-");
  if (opts?.btnDownload)    opts.btnDownload.disabled = true;

  outputMimeType = null;
  if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
  outputBlobUrl = null;

  if (opts?.outPreview) {
    opts.outPreview.removeAttribute("src");
    opts.outPreview.load();
  }
}

function log(line) {
  if (!opts?.onLogAppend) return;
  opts.onLogAppend(line);
}

function updateTimingSummary() {
  if (!opts?.onTimingSummary) return;
  opts.onTimingSummary(hashTimesMs);
}

/**
 * Wait for the camera to actually produce visible frames.
 */
async function waitForCameraReady(videoEl, warmupMs = 1500) {
  if (videoEl.readyState < 2) {
    await new Promise((resolve) => {
      const onReady = () => { videoEl.removeEventListener("loadeddata", onReady); resolve(); };
      videoEl.addEventListener("loadeddata", onReady);
    });
  }
  while (!videoEl.videoWidth || !videoEl.videoHeight) {
    await new Promise((r) => setTimeout(r, 50));
  }
  log("Camera active — warming up (" + warmupMs + "ms)…");
  await new Promise((r) => setTimeout(r, warmupMs));
  log("Camera ready.");
}

/** Prefer MP4 (H.264+AAC) where natively supported; fall back to WebM. */
function requireVideoMimeType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",  // Chrome Win/Mac, Safari, Edge (H.264+AAC)
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

/**
 * Commit a hash record to the local store and notify the caller.
 */
async function storeHash(record) {
  record.timestamp = Date.now();
  hashRecords.push(record);
  if (opts?.onHashRecord) await opts.onHashRecord(record);
}

// ---- Segment hashing ------------------------------------------------------

/**
 * Flush the current segment accumulator: hash, update rolling, store.
 *
 * If liveness has not yet resolved, the record is pushed to
 * pendingHashRecords instead of being committed immediately.  This
 * prevents premature blockchain submission in the (extremely rare) case
 * where the first 4 MB fills before the liveness API responds.
 */
async function flushSegment() {
  if (segmentLen === 0) return;

  // Build zero-padded segment buffer (mirrors new Uint8Array(SEG_SIZE) in JS)
  const segBytes = new Uint8Array(SEG_SIZE); // zero-filled
  let off = 0;
  for (let i = 0; i < segmentParts.length; i++) {
    segBytes.set(segmentParts[i], off);
    off += segmentParts[i].length;
  }

  const isPartial  = segmentLen < SEG_SIZE;
  const isGenesis  = segIndex === 0;
  const t0 = performance.now();

  const segHash    = await sha256Bytes(segBytes);
  const segHashHex = toHex(segHash);

  // roll_0 = SHA-256(segHash_0)
  // roll_i = SHA-256(roll_{i-1} || segHash_i)
  rolling = await rollingUpdate(rolling, segHash);
  const rollingHex = toHex(rolling);

  const dt = performance.now() - t0;
  hashTimesMs.push(dt);
  updateTimingSummary();

  // Build hash record
  const record = {
    index:      segIndex,
    segHashHex,
    rollingHex,
  };
  if (isGenesis) {
    record.type = "genesis";
    if (livenessData) {
      record.livenessScore  = livenessData.score;
      record.livenessResult = livenessData.result;
    }
  }

  const livenessStr = isGenesis && livenessData
    ? " | liveness=" + livenessData.result + " (score=" + livenessData.score.toFixed(4) + ")"
    : "";
  const label = isGenesis ? "GENESIS (SEG 0)" : "SEG " + segIndex;
  const logMsg =
    label +
    " | bytes=" + segmentLen +
    (isPartial ? " (padded→" + SEG_SIZE + ")" : "") +
    " | hash=" + dt.toFixed(2) + "ms" +
    " | seg=" + segHashHex.slice(0, 16) + "…" +
    " | roll=" + rollingHex.slice(0, 16) + "…" +
    livenessStr;

  if (livenessData) {
    // Liveness has already resolved — commit immediately
    await storeHash(record);
    log(logMsg);
  } else {
    // Liveness still pending — buffer; will be committed once liveness passes
    pendingHashRecords.push({ record, logMsg });
  }

  segIndex++;
  segmentParts = [];
  segmentLen   = 0;
}

/**
 * Feed raw MP4 bytes into the segment accumulator.
 * Automatically flushes full 4 MB segments as they fill.
 */
async function onEncodedChunk(u8) {
  let idx = 0;
  while (idx < u8.length) {
    const space = SEG_SIZE - segmentLen;
    const take  = Math.min(space, u8.length - idx);

    segmentParts.push(u8.subarray(idx, idx + take));
    segmentLen += take;
    idx        += take;

    if (segmentLen === SEG_SIZE) {
      await flushSegment();
    }
  }
}

// ---- Liveness flush -------------------------------------------------------

/**
 * Called when liveness PASSES.
 * Saves liveness metadata, tags the pending genesis record (if it exists),
 * commits all buffered records, and switches to LIVE_HASHING.
 */
async function onLivenessPassed(livenessResult) {
  livenessData = livenessResult;

  const livenessStr =
    " | liveness=" + livenessResult.result +
    " (score=" + livenessResult.score.toFixed(4) + ")";

  // Commit all buffered records in order, tagging genesis with liveness info
  for (const { record, logMsg } of pendingHashRecords) {
    if (record.index === 0) {
      record.livenessScore  = livenessResult.score;
      record.livenessResult = livenessResult.result;
    }
    await storeHash(record);
    log(logMsg + (record.index === 0 ? livenessStr : ""));
  }

  pendingHashRecords = [];
  phase = PHASE_LIVE_HASHING;
  log("Switched to LIVE_HASHING phase. Rolling hash active.");
}

// ---- ondataavailable router -----------------------------------------------

/**
 * All MediaRecorder chunks go through a serial promise queue so bytes
 * are always hashed in the same order they appear in the final file.
 */
function handleDataAvailable(e) {
  if (!e.data || e.data.size === 0) return;

  // Collect blob for final MP4 assembly (synchronous — always in order)
  recordedBlobs.push(e.data);

  // Chain processing so every chunk is fully handled before the next starts
  chunkQueue = chunkQueue.then(async () => {
    const u8 = new Uint8Array(await e.data.arrayBuffer());
    totalEncodedBytes += u8.length;

    if (phase === PHASE_LIVENESS_PENDING || phase === PHASE_LIVE_HASHING) {
      await onEncodedChunk(u8);
    }
    // STOPPED phase: ignore (shouldn't happen, but guard anyway)
  });
}

// ---- Public API -----------------------------------------------------------

export async function start(externalStream) {
  if (!opts) throw new Error("init() must be called before start().");
  resetRun();

  SEG_SIZE        = opts.segSize      || DEFAULT_SEG_SIZE;
  const timesliceMs = opts.timesliceMs || DEFAULT_TIMESLICE_MS;

  // ── Step 1: Require WebM ─────────────────────────────────────────────
  const mimeType = requireVideoMimeType();
  if (!mimeType) {
    throw new Error(
      "This browser does not support video recording via MediaRecorder.\n" +
      "Please use Chrome, Edge, Safari, or Firefox."
    );
  }
  outputMimeType = mimeType;

  // ── Step 2: Camera + mic ─────────────────────────────────────────────
  // If an external stream is provided (from the recording interface's
  // dual-stream setup), use it directly instead of calling getUserMedia
  if (externalStream) {
    cameraStream = externalStream;
    opts.livePreview.srcObject = cameraStream;
    await opts.livePreview.play();
    await waitForCameraReady(opts.livePreview);
  } else {
    // Wait for any in-flight requestCamera() to finish first
    if (cameraReadyPromise) await cameraReadyPromise;

    // Reuse the stream from requestCamera() if it's still active
    if (!cameraStream || !cameraStream.getVideoTracks().some((t) => t.readyState === "live")) {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      opts.livePreview.srcObject = cameraStream;
      await opts.livePreview.play();
      await waitForCameraReady(opts.livePreview);
    }
  }

  // ── Step 3: MediaRecorder ────────────────────────────────────────────
  recorder = new MediaRecorder(cameraStream, { mimeType });
  recorder.ondataavailable = handleDataAvailable;

  recorder.onstop = async () => {
    // Drain the serial chunk queue before doing anything else
    await chunkQueue;

    if (phase === PHASE_LIVE_HASHING) {
      // Flush any remaining partial segment
      await flushSegment();
    } else {
      // Liveness never passed (failed or user stopped early) — discard everything
      pendingHashRecords = [];
      segmentParts       = [];
      segmentLen         = 0;
    }

    phase = PHASE_STOPPED;

    const finalHash = rolling ? toHex(rolling) : "-";
    if (opts.onFinalHash) opts.onFinalHash(finalHash);

    // Assemble final MP4 blob
    if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
    const mp4Blob = new Blob(recordedBlobs, { type: outputMimeType });
    outputBlobUrl = URL.createObjectURL(mp4Blob);

    if (opts.outPreview)  opts.outPreview.src = outputBlobUrl;
    if (opts.btnDownload) opts.btnDownload.disabled = false;

    log(
      "DONE | totalBytes=" + totalEncodedBytes +
      " | segments=" + segIndex +
      " | finalRoll=" + (rolling ? toHex(rolling).slice(0, 24) + "…" : "-")
    );

    if (opts.onHashesReady) opts.onHashesReady(getHashes());
  };

  // ── Step 4: Start recording in LIVENESS_PENDING phase ───────────────
  phase = PHASE_LIVENESS_PENDING;
  recorder.start(timesliceMs);

  if (opts.btnStart)    opts.btnStart.disabled    = true;
  if (opts.btnStop)     opts.btnStop.disabled     = false;
  if (opts.btnDownload) opts.btnDownload.disabled = true;

  log(
    "RECORDING started | segSize=" + SEG_SIZE + " bytes" +
    " | timeslice=" + timesliceMs + "ms" +
    " | mime=" + mimeType
  );

  // REMOVED: no more checkLiveness() call here.
  // The recording interface will call notifyLivenessPassed() or
  // notifyLivenessFailed() after AWS liveness completes.
  log("RECORDING started | phase=LIVENESS_PENDING | awaiting external liveness signal");
  if (opts.onLivenessStatus) opts.onLivenessStatus("checking");
}

export function stop() {
  if (opts?.btnStop) opts.btnStop.disabled = true;
  if (recorder && recorder.state !== "inactive") recorder.stop();
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  if (opts?.btnStart) opts.btnStart.disabled = false;
}

/**
 * Called by the recording interface when AWS Rekognition liveness passes.
 * Triggers the phase transition from LIVENESS_PENDING → LIVE_HASHING,
 * flushes buffered hash records, and attaches liveness metadata to genesis.
 *
 * @param {{ score: number, result: string }} livenessResult
 */
export async function notifyLivenessPassed(livenessResult) {
  if (phase !== PHASE_LIVENESS_PENDING) {
    console.warn('[recording] notifyLivenessPassed called but phase is ' + phase);
    return;
  }
  log(
    "LIVENESS PASSED (external) | result=" + livenessResult.result +
    " | score=" + livenessResult.score.toFixed(4)
  );
  if (opts.onLivenessStatus) opts.onLivenessStatus("pass");
  if (opts.onLivenessPass) opts.onLivenessPass(livenessResult);
  await onLivenessPassed(livenessResult);
}

/**
 * Called by the recording interface when AWS Rekognition liveness fails.
 * Stops recording and discards all buffered data.
 */
export function notifyLivenessFailed() {
  if (phase !== PHASE_LIVENESS_PENDING) return;
  log("LIVENESS FAILED (external) — stopping and discarding.");
  if (opts.onLivenessStatus) opts.onLivenessStatus("fail");
  pendingHashRecords = [];
  segmentParts = [];
  segmentLen = 0;
  stop();
}

/**
 * Thorough cleanup — stops camera tracks, recorder, and resets all state.
 * Call on component unmount to prevent zombie streams/state.
 */
export function cleanup() {
  if (recorder && recorder.state !== "inactive") {
    try { recorder.stop(); } catch (_) { /* ignore */ }
  }
  recorder = null;

  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  cameraReadyPromise = null;

  if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
  outputBlobUrl  = null;
  outputMimeType = null;

  phase              = PHASE_IDLE;
  recordedBlobs      = [];
  segmentParts       = [];
  segmentLen         = 0;
  segIndex           = 0;
  rolling            = null;
  totalEncodedBytes  = 0;
  hashTimesMs        = [];
  hashRecords        = [];
  livenessData       = null;
  pendingHashRecords = [];
  chunkQueue         = Promise.resolve();
  opts               = null;
}

export function download(filenameBase = "recording") {
  if (!outputBlobUrl) throw new Error("No recording available to download yet.");
  const ext = outputMimeType?.includes("mp4") ? "mp4" : "webm";
  const a = document.createElement("a");
  a.href     = outputBlobUrl;
  a.download = filenameBase + "." + ext;
  a.rel      = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function getOutputInfo() {
  return { url: outputBlobUrl, mimeType: outputMimeType };
}

export function getVideoBlob() {
  if (!recordedBlobs.length) return null;
  return new Blob(recordedBlobs, { type: outputMimeType || 'video/mp4' });
}

export function getHashes() {
  return [...hashRecords];
}

/**
 * Request camera + mic permissions early and start the live preview.
 * The acquired stream is stored in `cameraStream` so start() can reuse it.
 * Deduplicates: if already in-flight, returns the existing promise.
 */
export async function requestCamera() {
  if (!opts) throw new Error("init() must be called before requestCamera().");
  if (cameraStream && cameraStream.getVideoTracks().some((t) => t.readyState === "live")) {
    // Already have an active stream
    return;
  }
  if (cameraReadyPromise) return cameraReadyPromise;

  cameraReadyPromise = (async () => {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    opts.livePreview.srcObject = cameraStream;
    await opts.livePreview.play();
    await waitForCameraReady(opts.livePreview);
  })();

  try {
    await cameraReadyPromise;
  } finally {
    cameraReadyPromise = null;
  }
}

export function init(options) {
  opts = options;
}

export function setLivePreview(el) {
  if (opts) opts.livePreview = el;
}
