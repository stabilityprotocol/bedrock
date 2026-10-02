import { describe, it, expect } from 'vitest';
import { compareHashTrails } from '../../src/verification/comparator.js';
import { SEG_SIZE } from '../../src/verification/hashing.js';

// Helper: build a calculated trail (from video-hasher output)
function makeCalculatedTrail(rollingHexes) {
  return rollingHexes.map((hex, i) => ({
    index: i,
    segHashHex: 'seg' + i, // not used for comparison
    rollingHex: hex,
  }));
}

// Helper: build an on-chain trail (from chain-reader output)
function makeOnChainTrail(newHashes) {
  return newHashes.map((hash, i) => ({
    previousHash: '0x' + '00'.repeat(32),
    newHash: hash,
    sequence: i,
    blockNumber: 100 + i,
    transactionHash: '0xtx' + i,
  }));
}

describe('comparator', () => {
  describe('compareHashTrails', () => {
    it('should return verified=true when final hashes match', () => {
      const hash = 'aa'.repeat(32);
      const calculated = makeCalculatedTrail([hash]);
      const onChain = makeOnChainTrail(['0x' + hash]);

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: 1000,
      });

      expect(result.verified).toBe(true);
      expect(result.tampering).toBeNull();
    });

    it('should return verified=true for multi-segment matching trails', () => {
      const hashes = ['aa'.repeat(32), 'bb'.repeat(32), 'cc'.repeat(32)];
      const calculated = makeCalculatedTrail(hashes);
      const onChain = makeOnChainTrail(hashes.map(h => '0x' + h));

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: SEG_SIZE * 2 + 500,
      });

      expect(result.verified).toBe(true);
      expect(result.tampering).toBeNull();
    });

    it('should detect tampering at segment 0 (first segment)', () => {
      const calcHashes = ['aa'.repeat(32), 'bb'.repeat(32)];
      const chainHashes = ['ff'.repeat(32), 'bb'.repeat(32)]; // seg 0 different

      const calculated = makeCalculatedTrail(calcHashes);
      const onChain = makeOnChainTrail(chainHashes.map(h => '0x' + h));

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: SEG_SIZE + 100,
      });

      expect(result.verified).toBe(false);
      expect(result.tampering).not.toBeNull();
      expect(result.tampering.divergenceSegmentIndex).toBe(0);
      expect(result.tampering.divergenceByteOffset).toBe(0);
    });

    it('should detect tampering at segment 2 (middle segment)', () => {
      const calcHashes = ['aa'.repeat(32), 'bb'.repeat(32), 'cc'.repeat(32), 'dd'.repeat(32)];
      const chainHashes = ['aa'.repeat(32), 'bb'.repeat(32), 'XX'.repeat(32), 'dd'.repeat(32)]; // seg 2 different

      const calculated = makeCalculatedTrail(calcHashes);
      const onChain = makeOnChainTrail(chainHashes.map(h => '0x' + h));

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: SEG_SIZE * 3 + 1000,
      });

      expect(result.verified).toBe(false);
      expect(result.tampering.divergenceSegmentIndex).toBe(2);
      expect(result.tampering.divergenceByteOffset).toBe(SEG_SIZE * 2);
    });

    it('should calculate approximate second when videoDurationSeconds is provided', () => {
      const calcHashes = ['aa'.repeat(32), 'bb'.repeat(32), 'cc'.repeat(32)];
      const chainHashes = ['aa'.repeat(32), 'XX'.repeat(32), 'cc'.repeat(32)]; // seg 1 different

      const calculated = makeCalculatedTrail(calcHashes);
      const onChain = makeOnChainTrail(chainHashes.map(h => '0x' + h));

      const totalFileSize = SEG_SIZE * 2 + 500;
      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize,
        videoDurationSeconds: 30,
      });

      expect(result.verified).toBe(false);
      expect(result.tampering.approximateSecond).toBeCloseTo(10, 0); // seg 1 of 3 segs, 30s total ≈ 10s
    });

    it('should return approximateSecond as null when videoDurationSeconds not provided', () => {
      const calcHashes = ['aa'.repeat(32), 'XX'.repeat(32)];
      const chainHashes = ['aa'.repeat(32), 'bb'.repeat(32)]; // seg 1 different

      const calculated = makeCalculatedTrail(calcHashes);
      const onChain = makeOnChainTrail(chainHashes.map(h => '0x' + h));

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: SEG_SIZE + 100,
      });

      expect(result.verified).toBe(false);
      expect(result.tampering.approximateSecond).toBeNull();
    });

    it('should handle single-segment files correctly', () => {
      const calcHash = 'aa'.repeat(32);
      const chainHash = 'bb'.repeat(32); // different

      const calculated = makeCalculatedTrail([calcHash]);
      const onChain = makeOnChainTrail(['0x' + chainHash]);

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: 1000,
      });

      expect(result.verified).toBe(false);
      expect(result.tampering.divergenceSegmentIndex).toBe(0);
    });

    it('should handle mismatched trail lengths (fewer on-chain entries)', () => {
      const calcHashes = ['aa'.repeat(32), 'bb'.repeat(32), 'cc'.repeat(32)];
      const chainHashes = ['aa'.repeat(32), 'bb'.repeat(32)]; // only 2 on-chain

      const calculated = makeCalculatedTrail(calcHashes);
      const onChain = makeOnChainTrail(chainHashes.map(h => '0x' + h));

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: SEG_SIZE * 2 + 500,
      });

      expect(result.verified).toBe(false);
      expect(result.tampering).not.toBeNull();
    });

    it('should include both on-chain and calculated hashes in tampering report', () => {
      const calcHash = 'aa'.repeat(32);
      const chainHash = 'bb'.repeat(32);

      const calculated = makeCalculatedTrail([calcHash]);
      const onChain = makeOnChainTrail(['0x' + chainHash]);

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: 1000,
      });

      expect(result.tampering.calculatedHash).toBe(calcHash);
      expect(result.tampering.onChainHash).toBe('0x' + chainHash);
    });

    it('should flag partialFile when file is shorter than on-chain trail but prefix matches', () => {
      const hashes = ['aa'.repeat(32), 'bb'.repeat(32), 'cc'.repeat(32)];
      // File has only first segment; on-chain has all three
      const calculated = makeCalculatedTrail([hashes[0]]);
      const onChain = makeOnChainTrail(hashes.map(h => '0x' + h));

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: 1000,
      });

      expect(result.verified).toBe(false);
      expect(result.partialFile).toBe(true);
      expect(result.tampering).not.toBeNull();
      expect(result.tampering.divergenceSegmentIndex).toBe(1);
      expect(result.tampering.calculatedHash).toMatch(/missing/);
      expect(result.tampering.onChainHash).toBe('0x' + hashes[1]);
    });

    it('should not flag partialFile when file is longer than on-chain trail', () => {
      const hashes = ['aa'.repeat(32), 'bb'.repeat(32)];
      // File has 3 segments; on-chain only 2
      const calculated = makeCalculatedTrail([...hashes, 'cc'.repeat(32)]);
      const onChain = makeOnChainTrail(hashes.map(h => '0x' + h));

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: 1000,
      });

      expect(result.verified).toBe(false);
      expect(result.partialFile).toBe(false);
    });

    it('should set partialFile=false on verified and normal tamper results', () => {
      const hash = 'aa'.repeat(32);
      const verifiedResult = compareHashTrails({
        calculatedRecords: makeCalculatedTrail([hash]),
        onChainTrail: makeOnChainTrail(['0x' + hash]),
        totalFileSize: 1000,
      });
      expect(verifiedResult.partialFile).toBe(false);

      const tamperedResult = compareHashTrails({
        calculatedRecords: makeCalculatedTrail([hash]),
        onChainTrail: makeOnChainTrail(['0x' + 'bb'.repeat(32)]),
        totalFileSize: 1000,
      });
      expect(tamperedResult.partialFile).toBe(false);
    });

    it('should include calculatedFinalHash and onChainFinalHash in result', () => {
      const hash = 'aa'.repeat(32);
      const calculated = makeCalculatedTrail([hash]);
      const onChain = makeOnChainTrail(['0x' + hash]);

      const result = compareHashTrails({
        calculatedRecords: calculated,
        onChainTrail: onChain,
        totalFileSize: 1000,
      });

      expect(result.calculatedFinalHash).toBe(hash);
      expect(result.onChainFinalHash).toBe('0x' + hash);
    });
  });
});
