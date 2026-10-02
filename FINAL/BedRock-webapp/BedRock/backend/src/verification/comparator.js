/**
 * Hash Trail Comparator & Tamper Detector
 *
 * Compares the calculated hash trail (from re-hashing the video file) against
 * the on-chain hash trail (from HashRecorded events on the Subcontract).
 *
 * Phase 3: If final hashes match → video is verified (untampered).
 * Phase 4: If final hashes differ → walks chunk-by-chunk to find the first
 *          divergence point, reports the segment index, byte offset, and
 *          approximate second where tampering was detected.
 */
import { SEG_SIZE } from './hashing.js';

/**
 * Normalize a hash to lowercase for comparison.
 * On-chain hashes have 0x prefix; calculated hashes don't.
 * We compare the raw 64-char hex portion.
 *
 * @param {string} hash - Hex hash with or without 0x prefix
 * @returns {string} Lowercase 64-char hex string (no 0x)
 */
export function normalizeHash(hash) {
  return hash.replace(/^0x/i, '').toLowerCase();
}

/**
 * Compare calculated hash trail against on-chain hash trail.
 *
 * @param {Object} params
 * @param {Array<{ index: number, segHashHex: string, rollingHex: string }>} params.calculatedRecords
 * @param {Array<{ previousHash: string, newHash: string, sequence: number }>} params.onChainTrail
 * @param {number} params.totalFileSize - Size of the video file in bytes
 * @param {number} [params.videoDurationSeconds] - Optional video duration for timestamp estimation
 * @returns {{
 *   verified: boolean,
 *   calculatedFinalHash: string,
 *   onChainFinalHash: string,
 *   totalCalculatedSegments: number,
 *   totalOnChainEntries: number,
 *   tampering: null | {
 *     divergenceSegmentIndex: number,
 *     divergenceByteOffset: number,
 *     approximateSecond: number|null,
 *     calculatedHash: string,
 *     onChainHash: string,
 *   }
 * }}
 */
export function compareHashTrails({ calculatedRecords, onChainTrail, totalFileSize, videoDurationSeconds }) {
  const calcLen = calculatedRecords.length;
  const chainLen = onChainTrail.length;

  const calculatedFinalHash = calcLen > 0 ? calculatedRecords[calcLen - 1].rollingHex : null;
  const onChainFinalHash = chainLen > 0 ? onChainTrail[chainLen - 1].newHash : null;

  // Walk all entries chunk-by-chunk to find the first divergence
  const minLen = Math.min(calcLen, chainLen);
  let divergenceIndex = -1;
  let calcHashAtDivergence = null;
  let chainHashAtDivergence = null;

  for (let i = 0; i < minLen; i++) {
    const calcHash = normalizeHash(calculatedRecords[i].rollingHex);
    const chainHash = normalizeHash(onChainTrail[i].newHash);

    if (calcHash !== chainHash) {
      divergenceIndex = i;
      calcHashAtDivergence = calculatedRecords[i].rollingHex;
      chainHashAtDivergence = onChainTrail[i].newHash;
      break;
    }
  }

  // Phase 3: No divergence in the overlapping range, lengths match → verified
  if (divergenceIndex === -1 && calcLen === chainLen) {
    return {
      verified: true,
      calculatedFinalHash,
      onChainFinalHash,
      totalCalculatedSegments: calcLen,
      totalOnChainEntries: chainLen,
      partialFile: false,
      tampering: null,
    };
  }

  // Partial file: all compared segments match but the file is shorter than the
  // on-chain trail. Someone extracted only the untampered prefix of a video.
  if (divergenceIndex === -1 && calcLen < chainLen) {
    return {
      verified: false,
      calculatedFinalHash,
      onChainFinalHash,
      totalCalculatedSegments: calcLen,
      totalOnChainEntries: chainLen,
      partialFile: true,
      tampering: {
        divergenceSegmentIndex: calcLen,
        divergenceByteOffset: calcLen * SEG_SIZE,
        approximateSecond: null,
        segmentStartSecond: null,
        segmentEndSecond: null,
        calculatedHash: '<missing — file truncated>',
        onChainHash: onChainTrail[calcLen].newHash,
      },
    };
  }

  // If all compared entries match but the file is LONGER than on-chain trail,
  // divergence is at the shorter trail's end (appended content).
  if (divergenceIndex === -1 && calcLen !== chainLen) {
    divergenceIndex = minLen;
    calcHashAtDivergence = calcLen > minLen ? calculatedRecords[minLen].rollingHex : '<missing>';
    chainHashAtDivergence = chainLen > minLen ? onChainTrail[minLen].newHash : '<missing>';
  }

  // Phase 4: Tampering detected — report divergence point
  // Compute the time window of the tampered segment (start → end), not a single point.
  let segmentStartSecond = null;
  let segmentEndSecond = null;
  let approximateSecond = null;
  if (divergenceIndex >= 0 && calcLen > 0) {
    let secondsPerSegment = null;
    if (videoDurationSeconds) {
      secondsPerSegment = videoDurationSeconds / calcLen;
    } else if (totalFileSize > 0) {
      const estimatedDuration = totalFileSize / (400 * 1024);
      secondsPerSegment = estimatedDuration / calcLen;
    }
    if (secondsPerSegment != null) {
      segmentStartSecond = Math.round(divergenceIndex * secondsPerSegment);
      segmentEndSecond = Math.round((divergenceIndex + 1) * secondsPerSegment);
      approximateSecond = segmentStartSecond; // kept for backwards compat
    }
  }

  return {
    verified: false,
    calculatedFinalHash,
    onChainFinalHash,
    totalCalculatedSegments: calcLen,
    totalOnChainEntries: chainLen,
    partialFile: false,
    tampering: divergenceIndex >= 0 ? {
      divergenceSegmentIndex: divergenceIndex,
      divergenceByteOffset: divergenceIndex * SEG_SIZE,
      approximateSecond,
      segmentStartSecond,
      segmentEndSecond,
      calculatedHash: calcHashAtDivergence,
      onChainHash: chainHashAtDivergence,
    } : null,
  };
}
