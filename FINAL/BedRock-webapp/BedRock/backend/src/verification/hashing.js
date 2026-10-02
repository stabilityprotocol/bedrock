/**
 * Hashing utilities — Node.js port of frontend/src/lib/hashing.js
 *
 * CRITICAL: This must produce byte-identical output to the frontend.
 * Same SEG_SIZE, same zero-padding, same SHA-256 rolling update.
 *
 * Algorithm (mirrors frontend/src/lib/hashing.js and tools/rehash.py):
 *   SEG_SIZE = 1.25 MB (1,310,720 bytes) by default — configurable via SEG_SIZE_BYTES env var
 *   segHash_i = SHA-256(zeroPad(segment_i, SEG_SIZE))
 *   roll_0    = SHA-256(segHash_0)                      [genesis]
 *   roll_i    = SHA-256(roll_{i-1} || segHash_i)        [subsequent, i >= 1]
 */
import { createHash } from 'node:crypto';

export const SEG_SIZE = Number(process.env.SEG_SIZE_BYTES) || 1_310_720; // default 1.25 MB — must match frontend

/**
 * SHA-256 hash of a Buffer.
 * @param {Buffer|Uint8Array} data
 * @returns {Buffer} 32-byte hash
 */
export function sha256(data) {
  return createHash('sha256').update(data).digest();
}

/**
 * Convert a Buffer to a lowercase hex string (no 0x prefix).
 * Matches frontend toHex() output exactly.
 * @param {Buffer|Uint8Array} buf
 * @returns {string}
 */
export function toHex(buf) {
  return Buffer.from(buf).toString('hex');
}

/**
 * Rolling hash update.
 *   Genesis (prevRoll is null): return SHA-256(segHash)
 *   Subsequent:                 return SHA-256(prevRoll || segHash)
 *
 * @param {Buffer|null} prevRollOrNull - Previous rolling hash (32 bytes), or null for genesis
 * @param {Buffer} segHash - Segment hash (32 bytes)
 * @returns {Buffer} Updated rolling hash (32 bytes)
 */
export function rollingUpdate(prevRollOrNull, segHash) {
  if (!prevRollOrNull) {
    return sha256(segHash);
  }
  return sha256(Buffer.concat([prevRollOrNull, segHash]));
}
