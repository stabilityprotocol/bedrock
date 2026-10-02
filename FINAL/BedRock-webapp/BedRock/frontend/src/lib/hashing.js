/**
 * Hashing utilities — ES module port of SNR_VBJ/hashing.js.
 * Zero logic changes; IIFE wrapper and window.Hashing removed.
 */
"use strict";

export function toHex(u8) {
  return Array.from(u8).map(b => b.toString(16).padStart(2, "0")).join("");
}

function concatU8(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// SHA-256 hashing using WebCrypto
export async function sha256Bytes(u8) {
  const hashBuf = await crypto.subtle.digest("SHA-256", u8);
  return new Uint8Array(hashBuf); // 32 bytes
}

// Rolling update:
// segHash = SHA-256(segmentBytes)
// roll_1 = SHA-256(segHash)
// roll_i = SHA-256(roll_{i-1} || segHash_i)
export async function rollingUpdate(prevRollOrNull, segHash32) {
  if (!prevRollOrNull) {
    return await sha256Bytes(segHash32);
  }
  return await sha256Bytes(concatU8(prevRollOrNull, segHash32));
}
