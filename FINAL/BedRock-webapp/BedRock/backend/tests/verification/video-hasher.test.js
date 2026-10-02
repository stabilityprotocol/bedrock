import { describe, it, expect } from 'vitest';
import { hashVideoBuffer } from '../../src/verification/video-hasher.js';
import { sha256, toHex, rollingUpdate, SEG_SIZE } from '../../src/verification/hashing.js';

describe('video-hasher', () => {
  describe('hashVideoBuffer', () => {
    it('should reject empty buffer', () => {
      expect(() => hashVideoBuffer(Buffer.alloc(0))).toThrow('empty');
    });

    it('should produce 1 record for a file smaller than SEG_SIZE', () => {
      const data = Buffer.alloc(100, 0x42);
      const result = hashVideoBuffer(data);

      expect(result.records).toHaveLength(1);
      expect(result.totalSegments).toBe(1);
      expect(result.records[0].index).toBe(0);
      expect(typeof result.records[0].segHashHex).toBe('string');
      expect(typeof result.records[0].rollingHex).toBe('string');
      expect(result.records[0].segHashHex).toHaveLength(64); // 32 bytes hex
      expect(result.records[0].rollingHex).toHaveLength(64);
      expect(result.finalRollingHex).toBe(result.records[0].rollingHex);
    });

    it('should produce 1 record for a file exactly SEG_SIZE bytes', () => {
      const data = Buffer.alloc(SEG_SIZE, 0xAA);
      const result = hashVideoBuffer(data);

      expect(result.records).toHaveLength(1);
      expect(result.totalSegments).toBe(1);

      // No padding needed — hash the full segment directly
      const expectedSegHash = sha256(data);
      expect(result.records[0].segHashHex).toBe(toHex(expectedSegHash));

      const expectedRolling = rollingUpdate(null, expectedSegHash);
      expect(result.records[0].rollingHex).toBe(toHex(expectedRolling));
    });

    it('should produce 2 records for SEG_SIZE + 1 bytes', () => {
      const data = Buffer.alloc(SEG_SIZE + 1, 0xBB);
      const result = hashVideoBuffer(data);

      expect(result.records).toHaveLength(2);
      expect(result.totalSegments).toBe(2);
      expect(result.records[0].index).toBe(0);
      expect(result.records[1].index).toBe(1);

      // Segment 0: first SEG_SIZE bytes (all 0xBB)
      const seg0Data = Buffer.alloc(SEG_SIZE, 0xBB);
      const segHash0 = sha256(seg0Data);
      expect(result.records[0].segHashHex).toBe(toHex(segHash0));

      const roll0 = rollingUpdate(null, segHash0);
      expect(result.records[0].rollingHex).toBe(toHex(roll0));

      // Segment 1: 1 byte (0xBB) + zero-pad to SEG_SIZE
      const seg1Padded = Buffer.alloc(SEG_SIZE);
      seg1Padded[0] = 0xBB;
      const segHash1 = sha256(seg1Padded);
      expect(result.records[1].segHashHex).toBe(toHex(segHash1));

      const roll1 = rollingUpdate(roll0, segHash1);
      expect(result.records[1].rollingHex).toBe(toHex(roll1));

      expect(result.finalRollingHex).toBe(toHex(roll1));
    });

    it('should produce 3 records for a file of SEG_SIZE * 2 + 500 bytes', () => {
      const size = SEG_SIZE * 2 + 500;
      const data = Buffer.alloc(size);
      // Fill with incrementing pattern for uniqueness
      for (let i = 0; i < size; i++) data[i] = i % 256;

      const result = hashVideoBuffer(data);

      expect(result.records).toHaveLength(3);
      expect(result.totalSegments).toBe(3);

      // Verify chain: manually compute and compare each step
      let rolling = null;
      for (let i = 0; i < 3; i++) {
        const start = i * SEG_SIZE;
        const chunk = data.subarray(start, Math.min(start + SEG_SIZE, data.length));
        const padded = Buffer.alloc(SEG_SIZE);
        chunk.copy(padded);
        const segHash = sha256(padded);
        rolling = rollingUpdate(rolling, segHash);

        expect(result.records[i].index).toBe(i);
        expect(result.records[i].segHashHex).toBe(toHex(segHash));
        expect(result.records[i].rollingHex).toBe(toHex(rolling));
      }

      expect(result.finalRollingHex).toBe(toHex(rolling));
    });

    it('should return totalFileSize matching input buffer length', () => {
      const data = Buffer.alloc(12345, 0x99);
      const result = hashVideoBuffer(data);
      expect(result.totalFileSize).toBe(12345);
    });
  });
});
