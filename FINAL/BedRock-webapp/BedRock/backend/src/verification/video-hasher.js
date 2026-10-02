/**
 * Video File Hasher — reads a file buffer and computes the full rolling hash chain.
 *
 * Mirrors the segmentation logic from frontend/src/lib/recording.js:
 *   1. Split file into sequential SEG_SIZE (4MB) chunks
 *   2. Zero-pad the last chunk to exactly SEG_SIZE
 *   3. Compute segHash = SHA-256(paddedChunk)
 *   4. Compute rolling hash via rollingUpdate()
 *
 * The output matches what the recording frontend produces and submits to the blockchain.
 */
import { sha256, toHex, rollingUpdate, SEG_SIZE } from './hashing.js';

/**
 * Hash a video file buffer into a rolling hash chain.
 *
 * @param {Buffer} fileBuffer - The raw video file bytes
 * @returns {{
 *   records: Array<{ index: number, segHashHex: string, rollingHex: string }>,
 *   finalRollingHex: string,
 *   totalSegments: number,
 *   totalFileSize: number,
 * }}
 */
export function hashVideoBuffer(fileBuffer) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Cannot hash empty file buffer');
  }

  const records = [];
  let rolling = null;
  let offset = 0;
  let segIndex = 0;

  while (offset < fileBuffer.length) {
    const chunk = fileBuffer.subarray(offset, offset + SEG_SIZE);
    offset += SEG_SIZE;

    // Zero-pad to SEG_SIZE (mirrors recording.js: new Uint8Array(SEG_SIZE) + set())
    const padded = Buffer.alloc(SEG_SIZE);
    chunk.copy(padded);

    const segHash = sha256(padded);
    rolling = rollingUpdate(rolling, segHash);

    records.push({
      index: segIndex,
      segHashHex: toHex(segHash),
      rollingHex: toHex(rolling),
    });

    segIndex++;
  }

  return {
    records,
    finalRollingHex: rolling ? toHex(rolling) : null,
    totalSegments: records.length,
    totalFileSize: fileBuffer.length,
  };
}
