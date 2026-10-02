/**
 * Verification Orchestrator
 *
 * Fast path: compare the calculated final rolling hash against the
 * Grandfather registry's stored finalHash. If they match, the video is
 * verified — no event trail query needed. The firstHash match is already
 * guaranteed by the Phase 1 subcontract lookup (firstHash is the key).
 *
 * Slow path (tampering detected): fetch the full HashRecorded event trail
 * and walk it to locate the first divergence point.
 */
import { hashVideoBuffer } from './video-hasher.js';
import { readOnChainSummary, readOnChainTrailEvents } from './chain-reader.js';
import { compareHashTrails, normalizeHash } from './comparator.js';

/**
 * Verify a video file against its on-chain hash trail.
 *
 * @param {Buffer} fileBuffer
 * @param {Object} contracts
 * @param {import('ethers').Contract} contracts.subcontract
 * @param {import('ethers').Contract} contracts.grandfather
 * @param {string} contracts.subcontractAddress
 * @param {number} [contracts.videoDurationSeconds]
 */
export async function verifyVideo(fileBuffer, contracts) {
  const { subcontract, grandfather, subcontractAddress, videoDurationSeconds } = contracts;

  // Parallel: on-chain summary (auth + state + registry, no events) runs
  // while the CPU-bound full re-hash executes.
  const summaryPromise = readOnChainSummary({ subcontract, grandfather, subcontractAddress });
  const { records, totalSegments, totalFileSize } = hashVideoBuffer(fileBuffer);
  const summary = await summaryPromise;

  const subcontractInfo = {
    owner: summary.owner,
    grandfatherAddress: summary.grandfatherAddress,
    isAuthorizedChild: summary.isAuthorizedChild,
    totalEntries: summary.totalEntries,
    isInitialized: summary.isInitialized,
    isFinalized: summary.isFinalized,
    deploymentBlock: summary.deploymentBlock,
  };

  const calcFinalHex = records.length > 0 ? records[records.length - 1].rollingHex : null;

  // Fast path: Grandfather registry's finalHash matches our calculated final
  // rolling hash. Because rolling hashes chain all prior segments, a match
  // here cryptographically implies the whole trail matches.
  if (
    calcFinalHex &&
    summary.registryFinalHash &&
    normalizeHash(calcFinalHex) === normalizeHash(summary.registryFinalHash)
  ) {
    return {
      verified: true,
      calculatedFinalHash: calcFinalHex,
      onChainFinalHash: summary.registryFinalHash,
      totalSegments,
      totalOnChainEntries: summary.totalEntries,
      partialFile: false,
      subcontractInfo,
      tampering: null,
    };
  }

  // Slow path: finals don't match (or registry missing). Fetch full event
  // trail to locate the first divergence point for the tampering report.
  const { trail } = await readOnChainTrailEvents({
    subcontract,
    deploymentBlock: summary.deploymentBlock,
    totalEntries: summary.totalEntries,
  });

  const comparison = compareHashTrails({
    calculatedRecords: records,
    onChainTrail: trail,
    totalFileSize,
    videoDurationSeconds,
  });

  return {
    verified: comparison.verified,
    calculatedFinalHash: comparison.calculatedFinalHash,
    onChainFinalHash: comparison.onChainFinalHash,
    totalSegments,
    totalOnChainEntries: comparison.totalOnChainEntries,
    partialFile: comparison.partialFile || false,
    subcontractInfo,
    tampering: comparison.tampering,
  };
}
