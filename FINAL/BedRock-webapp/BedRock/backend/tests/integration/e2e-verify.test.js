/**
 * End-to-End Integration Test: Deploy → Hash → Write On-Chain → Verify
 *
 * This test exercises the FULL pipeline:
 *   1. Create a deterministic test buffer
 *   2. Hash it with the same algorithm used in recording
 *   3. Deploy a fresh subcontract via the API
 *   4. Submit hashes to the queue via the API
 *   5. Wait for the worker to write them on-chain
 *   6. Verify via POST /api/verify — expect verified: true
 *   7. Tamper with the buffer and verify again — expect verified: false with paper trail
 *
 * Prerequisites:
 *   - Backend running: npm run dev
 *   - Redis running
 *   - Valid .env with RPC_URL, API_KEY, PRIVATE_KEY, GRANDFATHER_ADDRESS
 *
 * Run:
 *   node tests/integration/e2e-verify.test.js
 */

import { hashVideoBuffer } from '../../src/verification/video-hasher.js';
import { SEG_SIZE } from '../../src/verification/hashing.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3001';

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(phase, msg) {
  console.log(`\n[${'='.repeat(60)}]`);
  console.log(`[${phase}] ${msg}`);
  console.log(`[${'='.repeat(60)}]`);
}

function step(msg) {
  console.log(`  → ${msg}`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiPost(path, body) {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`POST ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  return data;
}

async function apiGet(path) {
  const res = await fetch(BASE_URL + path);
  const data = await res.json();
  return { status: res.status, data };
}

async function apiPostMultipart(path, fields) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Blob) {
      formData.append(key, value, 'test-video.bin');
    } else {
      formData.append(key, String(value));
    }
  }
  const res = await fetch(BASE_URL + path, { method: 'POST', body: formData });
  const data = await res.json();
  return { status: res.status, data };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // ── Phase 1: Create unique test buffer ──────────────────────────────────
  log('PHASE 1', 'Creating test video buffer');

  // 2 segments: one full + one partial (1KB), so we get 2 hash records
  // IMPORTANT: Each run must produce unique hashes because the Grandfather
  // contract enforces global uniqueness on first/final hashes across ALL
  // subcontracts. We seed the buffer with the current timestamp.
  const bufferSize = SEG_SIZE + 1024;
  const testBuffer = Buffer.alloc(bufferSize);
  const seed = Date.now();
  for (let i = 0; i < bufferSize; i++) {
    testBuffer[i] = (i * 7 + 13 + (seed & 0xff)) & 0xff;
  }
  // Write the full seed into the first 8 bytes for extra uniqueness
  testBuffer.writeBigUInt64BE(BigInt(seed), 0);

  step(`Buffer size: ${bufferSize} bytes (${(bufferSize / (1024 * 1024)).toFixed(2)} MB)`);

  // ── Phase 2: Hash the buffer ─────────────────────────────────────────────
  log('PHASE 2', 'Hashing buffer with video-hasher');

  const { records, finalRollingHex, totalSegments, totalFileSize } = hashVideoBuffer(testBuffer);

  step(`Total segments: ${totalSegments}`);
  step(`Final rolling hash: ${finalRollingHex.slice(0, 20)}...`);
  for (const r of records) {
    step(`  seg[${r.index}] rolling=${r.rollingHex.slice(0, 16)}... seg=${r.segHashHex.slice(0, 16)}...`);
  }

  // ── Phase 3: Deploy a fresh subcontract ──────────────────────────────────
  log('PHASE 3', 'Deploying fresh subcontract via POST /api/subcontract/deploy');

  const deployResult = await apiPost('/api/subcontract/deploy', {});
  const { subcontractAddress, deploymentBlock, signerEoa } = deployResult;

  step(`Subcontract: ${subcontractAddress}`);
  step(`Deployment block: ${deploymentBlock}`);
  step(`Signer: ${signerEoa}`);

  // ── Phase 4: Submit hashes to the queue ──────────────────────────────────
  log('PHASE 4', 'Submitting hashes via POST /api/hashes/submit');

  const recordingId = `e2e-test-${Date.now()}`;
  const hashPayload = records.map((r, i) => ({
    index: r.index,
    segHashHex: r.segHashHex,
    rollingHex: r.rollingHex,
    timestamp: Date.now(),
    type: i === 0 ? 'genesis' : 'segment',
    isFinalHash: i === records.length - 1,
  }));

  const submitResult = await apiPost('/api/hashes/submit', {
    recordingId,
    subcontractAddress,
    hashes: hashPayload,
  });

  step(`Queued: ${submitResult.queued} jobs`);
  step(`Job IDs: ${submitResult.jobIds.join(', ')}`);

  // ── Phase 5: Wait for on-chain processing ────────────────────────────────
  log('PHASE 5', 'Waiting for worker to write hashes on-chain...');

  const maxWait = 180_000; // 3 minutes max
  const pollInterval = 5_000;
  const startTime = Date.now();
  let lastStatus = 'not_started';

  while (Date.now() - startTime < maxWait) {
    const { status: httpStatus, data } = await apiGet(`/api/subcontract/${subcontractAddress}/status`);

    if (httpStatus === 200 && data.status === 'complete') {
      step('On-chain writing COMPLETE!');
      step(`Summary: ${JSON.stringify(data.summary, null, 2)}`);
      lastStatus = 'complete';
      break;
    }

    lastStatus = data.status || 'unknown';
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    step(`Status: ${lastStatus} (${elapsed}s elapsed, polling every ${pollInterval / 1000}s...)`);
    await sleep(pollInterval);
  }

  if (lastStatus !== 'complete') {
    console.error('\n  TIMEOUT: Hashes were not written on-chain within 3 minutes.');
    console.error('  Last status:', lastStatus);
    console.error('  Check backend logs for worker errors.');
    process.exit(1);
  }

  // ── Phase 6: Verify the ORIGINAL buffer (should pass) ───────────────────
  log('PHASE 6', 'Verifying ORIGINAL buffer via POST /api/verify — expect VERIFIED');

  const originalBlob = new Blob([testBuffer], { type: 'video/mp4' });
  const verifyResult = await apiPostMultipart('/api/verify', {
    file: originalBlob,
    subcontractAddress,
    videoDurationSeconds: 10,
  });

  step(`HTTP status: ${verifyResult.status}`);
  step(`Verified: ${verifyResult.data.verified}`);
  step(`Total segments: ${verifyResult.data.totalSegments}`);
  step(`Calculated final hash: ${verifyResult.data.calculatedFinalHash?.slice(0, 20)}...`);
  step(`On-chain final hash: ${verifyResult.data.onChainFinalHash?.slice(0, 20)}...`);

  if (verifyResult.data.verified !== true) {
    console.error('\n  FAIL: Expected verified=true for the original buffer!');
    console.error('  Full result:', JSON.stringify(verifyResult.data, null, 2));
    process.exit(1);
  }

  step('PASS — Original buffer verified successfully!');

  // ── Phase 7: Tamper with the buffer and verify again (should fail) ──────
  log('PHASE 7', 'Verifying TAMPERED buffer via POST /api/verify — expect TAMPERED');

  const tamperedBuffer = Buffer.from(testBuffer);
  // Flip bytes in the second segment (after 4MB offset)
  const tamperOffset = SEG_SIZE + 100;
  tamperedBuffer[tamperOffset] = tamperedBuffer[tamperOffset] ^ 0xff;
  tamperedBuffer[tamperOffset + 1] = tamperedBuffer[tamperOffset + 1] ^ 0xff;

  const tamperedBlob = new Blob([tamperedBuffer], { type: 'video/mp4' });
  const tamperResult = await apiPostMultipart('/api/verify', {
    file: tamperedBlob,
    subcontractAddress,
    videoDurationSeconds: 10,
  });

  step(`HTTP status: ${tamperResult.status}`);
  step(`Verified: ${tamperResult.data.verified}`);

  if (tamperResult.data.verified !== false) {
    console.error('\n  FAIL: Expected verified=false for the tampered buffer!');
    console.error('  Full result:', JSON.stringify(tamperResult.data, null, 2));
    process.exit(1);
  }

  step('PASS — Tampered buffer correctly detected!');

  if (tamperResult.data.tampering) {
    const t = tamperResult.data.tampering;
    step(`Paper trail:`);
    step(`  Divergence segment: ${t.divergenceSegmentIndex}`);
    step(`  Byte offset: ${t.divergenceByteOffset}`);
    step(`  Approximate second: ${t.approximateSecond}`);
    step(`  Calculated hash: ${t.calculatedHash?.slice(0, 20)}...`);
    step(`  On-chain hash: ${t.onChainHash?.slice(0, 20)}...`);
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  log('DONE', 'All tests passed!');
  console.log(`
  Summary:
    Subcontract:  ${subcontractAddress}
    Segments:     ${totalSegments}
    Original:     VERIFIED ✓
    Tampered:     DETECTED ✓ (segment ${tamperResult.data.tampering?.divergenceSegmentIndex})
  `);

  process.exit(0);
}

main().catch((err) => {
  console.error('\n  FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
