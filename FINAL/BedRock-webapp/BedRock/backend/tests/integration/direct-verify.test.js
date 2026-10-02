/**
 * Direct Integration Test: Deploy → Write Hashes On-Chain → Verify
 *
 * This test bypasses BullMQ entirely and writes hashes directly to the blockchain
 * using SubcontractService.addCumulativeHashDirect + awaitReceipt.
 *
 * Steps:
 *   1. Create a deterministic test buffer (2 segments)
 *   2. Hash it with hashVideoBuffer (same algorithm as recording)
 *   3. Deploy a fresh subcontract via GrandfatherService
 *   4. Write each hash directly on-chain (staticCall preflight → submit → await receipt)
 *   5. Verify original buffer via verifyVideo — expect verified: true
 *   6. Verify tampered buffer via verifyVideo — expect verified: false with paper trail
 *
 * Prerequisites:
 *   - Redis running (for env loading only, not used directly)
 *   - Valid .env with RPC_URL, API_KEY, PRIVATE_KEY, GRANDFATHER_ADDRESS
 *
 * Run:
 *   node tests/integration/direct-verify.test.js
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env manually ──────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '..', '.env');

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

import { hashVideoBuffer } from '../../src/verification/video-hasher.js';
import { verifyVideo } from '../../src/verification/verify.js';
import { buildProvider, buildSigner, buildContract } from '../../src/smartcontract/ZgtEthersFactory.js';
import { GrandfatherABI, SubcontractABI } from '../../src/smartcontract/abi.js';
import GrandfatherService from '../../src/smartcontract/GrandfatherService.js';
import SubcontractService from '../../src/smartcontract/SubcontractService.js';
import { awaitReceipt } from '../../src/smartcontract/ReceiptService.js';
import { SEG_SIZE } from '../../src/verification/hashing.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(phase, msg) {
  console.log(`\n[${'='.repeat(60)}]`);
  console.log(`[${phase}] ${msg}`);
  console.log(`[${'='.repeat(60)}]`);
}

function step(msg) {
  console.log(`  → ${msg}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // ── Phase 1: Create unique test buffer ──────────────────────────────────────
  log('PHASE 1', 'Creating test video buffer');

  // 2 segments: one full (4MB) + one partial (1KB), so we get 2 hash records
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

  // ── Phase 2: Hash the buffer ───────────────────────────────────────────────
  log('PHASE 2', 'Hashing buffer with video-hasher');

  const { records, finalRollingHex, totalSegments } = hashVideoBuffer(testBuffer);

  step(`Total segments: ${totalSegments}`);
  step(`Final rolling hash: ${finalRollingHex.slice(0, 20)}...`);
  for (const r of records) {
    step(`  seg[${r.index}] rolling=${r.rollingHex.slice(0, 16)}... seg=${r.segHashHex.slice(0, 16)}...`);
  }

  // ── Phase 3: Build ethers context + Deploy subcontract ─────────────────────
  log('PHASE 3', 'Deploying fresh subcontract via GrandfatherService');

  const provider = buildProvider();
  const signer = buildSigner(provider);
  const grandfatherAddress = process.env.GRANDFATHER_ADDRESS;
  const grandfatherContract = buildContract(grandfatherAddress, GrandfatherABI, signer);

  step(`Grandfather: ${grandfatherAddress}`);
  step(`Signer: ${await signer.getAddress()}`);

  // Deploy
  const { txHash: deployTxHash } = await GrandfatherService.createSubcontractDirect(grandfatherContract);
  step(`Deploy tx submitted: ${deployTxHash}`);

  const deployReceipt = await awaitReceipt(provider, deployTxHash, {
    verificationStep: 'deploy',
    hashLabel: 'createSubcontract',
    timeoutMs: 120000,
    pollIntervalMs: 2000,
  });
  step(`Deploy receipt: block=${deployReceipt.blockNumber} status=${deployReceipt.status}`);

  const subcontractAddress = GrandfatherService.extractSubcontractAddressFromReceipt(deployReceipt);
  step(`Subcontract deployed: ${subcontractAddress}`);

  // Verify bytecode
  const code = await provider.getCode(subcontractAddress);
  if (!code || code === '0x') {
    throw new Error('No bytecode at deployed subcontract address');
  }
  step('Bytecode verified ✓');

  const subcontractContract = buildContract(subcontractAddress, SubcontractABI, signer);

  // Verify initial state
  const [initState_totalEntries, initState_isInit, initState_isFinal] = await Promise.all([
    subcontractContract.totalEntries(),
    subcontractContract.isInitialized(),
    subcontractContract.isFinalized(),
  ]);
  step(`Initial state: totalEntries=${initState_totalEntries} isInitialized=${initState_isInit} isFinalized=${initState_isFinal}`);

  if (Number(initState_totalEntries) !== 0 || initState_isInit || initState_isFinal) {
    throw new Error('Fresh subcontract should have 0 entries, not initialized, not finalized');
  }
  step('Initial state verified ✓');

  // ── Phase 4: Write hashes directly on-chain ────────────────────────────────
  log('PHASE 4', 'Writing hashes directly to blockchain (bypassing BullMQ)');

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const hash = '0x' + r.rollingHex;
    const isFirst = i === 0;
    const isFinal = i === records.length - 1;

    step(`Writing seg[${i}]: hash=${hash.slice(0, 18)}... isFirst=${isFirst} isFinal=${isFinal}`);

    // staticCall preflight
    try {
      await subcontractContract.addCumulativeHash.staticCall(hash, isFinal, isFirst);
      step(`  staticCall preflight: OK ✓`);
    } catch (err) {
      throw new Error(`staticCall preflight failed for seg[${i}]: ${err.message}`);
    }

    // Submit real transaction
    const { txHash } = await SubcontractService.addCumulativeHashDirect(
      subcontractContract,
      hash,
      { isFinal, isFirst }
    );
    step(`  tx submitted: ${txHash}`);

    // Await receipt
    const receipt = await awaitReceipt(provider, txHash, {
      verificationStep: 'direct-write',
      hashLabel: `seg=${i}`,
      timeoutMs: 120000,
    pollIntervalMs: 2000,
    });
    step(`  receipt: block=${receipt.blockNumber} status=${receipt.status}`);

    // Parse HashRecorded event
    const hashRecordedLog = receipt.logs
      .map((l) => { try { return subcontractContract.interface.parseLog(l); } catch { return null; } })
      .find((p) => p?.name === 'HashRecorded');

    if (!hashRecordedLog) {
      throw new Error(`HashRecorded event not found for seg[${i}]`);
    }

    const emittedHash = hashRecordedLog.args.newHash ?? hashRecordedLog.args[1];
    if (emittedHash.toLowerCase() !== hash.toLowerCase()) {
      throw new Error(`HashRecorded mismatch for seg[${i}]: expected=${hash} got=${emittedHash}`);
    }
    step(`  HashRecorded validated ✓ (seq=${hashRecordedLog.args.sequence ?? hashRecordedLog.args[2]})`);
  }

  // Verify post-write state
  const [postState_totalEntries, postState_isInit, postState_isFinal] = await Promise.all([
    subcontractContract.totalEntries(),
    subcontractContract.isInitialized(),
    subcontractContract.isFinalized(),
  ]);
  step(`Post-write state: totalEntries=${postState_totalEntries} isInitialized=${postState_isInit} isFinalized=${postState_isFinal}`);

  if (Number(postState_totalEntries) !== records.length) {
    throw new Error(`Expected totalEntries=${records.length}, got ${postState_totalEntries}`);
  }
  if (!postState_isInit || !postState_isFinal) {
    throw new Error('Expected isInitialized=true and isFinalized=true after writing all hashes');
  }
  step('Post-write state verified ✓');

  // ── Phase 5: Verify ORIGINAL buffer ────────────────────────────────────────
  log('PHASE 5', 'Verifying ORIGINAL buffer via verifyVideo — expect VERIFIED');

  const verifyResult = await verifyVideo(testBuffer, {
    subcontract: subcontractContract,
    grandfather: grandfatherContract,
    subcontractAddress,
    videoDurationSeconds: 10,
  });

  step(`Verified: ${verifyResult.verified}`);
  step(`Calculated final hash: ${verifyResult.calculatedFinalHash?.slice(0, 20)}...`);
  step(`On-chain final hash:   ${verifyResult.onChainFinalHash?.slice(0, 20)}...`);
  step(`Total segments: ${verifyResult.totalSegments}`);
  step(`Subcontract info: totalEntries=${verifyResult.subcontractInfo.totalEntries} isInit=${verifyResult.subcontractInfo.isInitialized} isFinal=${verifyResult.subcontractInfo.isFinalized}`);

  if (verifyResult.verified !== true) {
    console.error('\n  FAIL: Expected verified=true for the original buffer!');
    console.error('  Full result:', JSON.stringify(verifyResult, null, 2));
    process.exit(1);
  }

  step('PASS — Original buffer verified successfully! ✓');

  // ── Phase 6: Verify TAMPERED buffer ────────────────────────────────────────
  log('PHASE 6', 'Verifying TAMPERED buffer via verifyVideo — expect TAMPERED');

  const tamperedBuffer = Buffer.from(testBuffer);
  // Flip bytes in the second segment (after 4MB offset)
  const tamperOffset = SEG_SIZE + 100;
  tamperedBuffer[tamperOffset] = tamperedBuffer[tamperOffset] ^ 0xff;
  tamperedBuffer[tamperOffset + 1] = tamperedBuffer[tamperOffset + 1] ^ 0xff;

  const tamperResult = await verifyVideo(tamperedBuffer, {
    subcontract: subcontractContract,
    grandfather: grandfatherContract,
    subcontractAddress,
    videoDurationSeconds: 10,
  });

  step(`Verified: ${tamperResult.verified}`);

  if (tamperResult.verified !== false) {
    console.error('\n  FAIL: Expected verified=false for the tampered buffer!');
    console.error('  Full result:', JSON.stringify(tamperResult, null, 2));
    process.exit(1);
  }

  step('PASS — Tampered buffer correctly detected! ✓');

  if (tamperResult.tampering) {
    const t = tamperResult.tampering;
    step(`Paper trail:`);
    step(`  Divergence segment: ${t.divergenceSegmentIndex}`);
    step(`  Byte offset: ${t.divergenceByteOffset}`);
    step(`  Approximate second: ${t.approximateSecond}`);
    step(`  Calculated hash: ${t.calculatedHash?.slice(0, 20)}...`);
    step(`  On-chain hash:   ${t.onChainHash?.slice(0, 20)}...`);
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  log('DONE', 'All tests passed!');
  console.log(`
  Summary:
    Subcontract:  ${subcontractAddress}
    Segments:     ${totalSegments}
    Original:     VERIFIED ✓
    Tampered:     DETECTED ✓ (segment ${tamperResult.tampering?.divergenceSegmentIndex})
  `);

  process.exit(0);
}

main().catch((err) => {
  console.error('\n  FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
