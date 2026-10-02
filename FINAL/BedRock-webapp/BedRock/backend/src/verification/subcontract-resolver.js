import { sha256, toHex, rollingUpdate, SEG_SIZE } from './hashing.js';

/**
 * Compute the first rolling hash from a video file buffer.
 * This is the genesis hash: SHA-256(SHA-256(zeroPad(segment_0, SEG_SIZE)))
 *
 * Only hashes the first segment — the full re-hash happens later during
 * verification in hashVideoBuffer. Must produce a value identical to
 * hashVideoBuffer(fileBuffer).records[0].rollingHex.
 *
 * @param {Buffer} fileBuffer — raw video bytes
 * @returns {string} — 64-char lowercase hex (no 0x prefix)
 */
export function computeFirstHash(fileBuffer) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('File produced zero hash segments');
  }
  const firstChunk = fileBuffer.subarray(0, SEG_SIZE);
  const padded = Buffer.alloc(SEG_SIZE);
  firstChunk.copy(padded);
  const segHash = sha256(padded);
  const roll0 = rollingUpdate(null, segHash);
  return toHex(roll0);
}

/**
 * Look up a subcontract address from the Grandfather contract using the
 * video's first rolling hash.
 *
 * @param {import('ethers').Contract} grandfather — Grandfather contract instance
 * @param {string} firstHashHex — 64-char hex (no 0x prefix)
 * @returns {Promise<string|null>} — subcontract address, or null if not found
 */
export async function resolveSubcontract(grandfather, firstHashHex) {
  const firstHashBytes32 = '0x' + firstHashHex;
  const address = await grandfather.getSubcontractByFirstHash(firstHashBytes32);

  // ethers returns address(0) when no mapping exists
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  if (!address || address.toLowerCase() === ZERO_ADDRESS) {
    return null;
  }

  return address;
}
