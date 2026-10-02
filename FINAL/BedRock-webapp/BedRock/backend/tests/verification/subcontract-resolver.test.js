import { describe, it, expect } from 'vitest';
import { computeFirstHash, resolveSubcontract } from '../../src/verification/subcontract-resolver.js';
import { hashVideoBuffer } from '../../src/verification/video-hasher.js';

describe('computeFirstHash', () => {
  it('should return the first rolling hash from a file buffer', () => {
    const buf = Buffer.alloc(100, 0x42);
    const result = computeFirstHash(buf);

    // Independently verify via hashVideoBuffer
    const { records } = hashVideoBuffer(buf);
    expect(result).toBe(records[0].rollingHex);
  });

  it('should return a 64-char lowercase hex string without 0x prefix', () => {
    const buf = Buffer.alloc(100, 0xAA);
    const result = computeFirstHash(buf);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce the same hash for identical buffers', () => {
    const buf1 = Buffer.alloc(500, 0x33);
    const buf2 = Buffer.alloc(500, 0x33);
    expect(computeFirstHash(buf1)).toBe(computeFirstHash(buf2));
  });

  it('should produce different hashes for different buffers', () => {
    const buf1 = Buffer.alloc(500, 0x33);
    const buf2 = Buffer.alloc(500, 0x44);
    expect(computeFirstHash(buf1)).not.toBe(computeFirstHash(buf2));
  });
});

describe('resolveSubcontract', () => {
  // Scenario 1 & 2: first hash matches → subcontract address returned
  it('should return subcontract address when first hash matches (scenarios 1 & 2)', async () => {
    const mockGrandfather = {
      getSubcontractByFirstHash: async () => '0x1234567890abcdef1234567890abcdef12345678',
    };
    const result = await resolveSubcontract(mockGrandfather, 'aa'.repeat(32));
    expect(result).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  // Scenario 3: video was never recorded through the platform
  it('should return null when no subcontract matches — video never recorded (scenario 3)', async () => {
    const mockGrandfather = {
      getSubcontractByFirstHash: async () => '0x' + '0'.repeat(40),
    };
    const result = await resolveSubcontract(mockGrandfather, 'bb'.repeat(32));
    expect(result).toBeNull();
  });

  it('should prepend 0x to the hash before querying', async () => {
    let queriedHash = null;
    const mockGrandfather = {
      getSubcontractByFirstHash: async (h) => { queriedHash = h; return '0x' + '0'.repeat(40); },
    };
    await resolveSubcontract(mockGrandfather, 'cc'.repeat(32));
    expect(queriedHash).toBe('0x' + 'cc'.repeat(32));
  });
});

describe('end-to-end scenario mapping', () => {
  // Scenario 3: Never recorded — first hash not found on Grandfather
  it('scenario 3: resolveSubcontract returns null → caller returns 404', async () => {
    const buf = Buffer.alloc(100, 0xFF);
    const firstHash = computeFirstHash(buf);
    expect(firstHash).toMatch(/^[0-9a-f]{64}$/);

    const mockGrandfather = {
      getSubcontractByFirstHash: async () => '0x0000000000000000000000000000000000000000',
    };
    const address = await resolveSubcontract(mockGrandfather, firstHash);
    expect(address).toBeNull();
  });
});
