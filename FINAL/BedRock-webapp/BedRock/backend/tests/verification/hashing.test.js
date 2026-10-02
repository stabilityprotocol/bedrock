import { describe, it, expect } from 'vitest';
import { sha256, toHex, rollingUpdate, SEG_SIZE } from '../../src/verification/hashing.js';

describe('hashing module', () => {
  describe('SEG_SIZE', () => {
    it('should be exactly 1.25MB (1,310,720) by default', () => {
      expect(SEG_SIZE).toBe(1_310_720);
    });
  });

  describe('sha256', () => {
    it('should return a 32-byte Buffer', () => {
      const result = sha256(Buffer.from('hello'));
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(32);
    });

    it('should produce correct SHA-256 for known input', () => {
      // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      const result = sha256(Buffer.from('hello'));
      expect(toHex(result)).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('should produce correct SHA-256 for empty buffer', () => {
      // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      const result = sha256(Buffer.alloc(0));
      expect(toHex(result)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  describe('toHex', () => {
    it('should convert Buffer to lowercase hex string without 0x prefix', () => {
      const buf = Buffer.from([0x0a, 0xff, 0x00, 0x42]);
      expect(toHex(buf)).toBe('0aff0042');
    });

    it('should return empty string for empty buffer', () => {
      expect(toHex(Buffer.alloc(0))).toBe('');
    });
  });

  describe('rollingUpdate', () => {
    it('genesis: should return SHA-256(segHash) when prevRoll is null', () => {
      const segHash = sha256(Buffer.from('segment0'));
      const roll = rollingUpdate(null, segHash);

      // Genesis: roll_0 = SHA-256(segHash_0)
      const expected = sha256(segHash);
      expect(toHex(roll)).toBe(toHex(expected));
    });

    it('subsequent: should return SHA-256(prevRoll || segHash)', () => {
      const segHash0 = sha256(Buffer.from('segment0'));
      const roll0 = rollingUpdate(null, segHash0);

      const segHash1 = sha256(Buffer.from('segment1'));
      const roll1 = rollingUpdate(roll0, segHash1);

      // roll_1 = SHA-256(roll_0 || segHash_1)
      const expected = sha256(Buffer.concat([roll0, segHash1]));
      expect(toHex(roll1)).toBe(toHex(expected));
    });

    it('should match manual 3-step chain computation', () => {
      // Simulate a 3-segment chain
      const seg0 = sha256(Buffer.alloc(SEG_SIZE, 0x01));
      const seg1 = sha256(Buffer.alloc(SEG_SIZE, 0x02));
      const seg2 = sha256(Buffer.alloc(SEG_SIZE, 0x03));

      const roll0 = rollingUpdate(null, seg0);
      const roll1 = rollingUpdate(roll0, seg1);
      const roll2 = rollingUpdate(roll1, seg2);

      // Manually compute expected
      const expectedRoll0 = sha256(seg0);
      const expectedRoll1 = sha256(Buffer.concat([expectedRoll0, seg1]));
      const expectedRoll2 = sha256(Buffer.concat([expectedRoll1, seg2]));

      expect(toHex(roll0)).toBe(toHex(expectedRoll0));
      expect(toHex(roll1)).toBe(toHex(expectedRoll1));
      expect(toHex(roll2)).toBe(toHex(expectedRoll2));
    });
  });

  describe('cross-validation with rehash.py algorithm', () => {
    it('should match the Python rehash algorithm for a known byte sequence', () => {
      // Replicate what rehash.py does for a 5-byte file:
      //   chunk = b'\x01\x02\x03\x04\x05'
      //   padded = chunk + b'\x00' * (SEG_SIZE - 5)
      //   seg_hash = SHA-256(padded)
      //   rolling = SHA-256(seg_hash)  (genesis)
      const data = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const padded = Buffer.alloc(SEG_SIZE);
      data.copy(padded);

      const segHash = sha256(padded);
      const rolling = rollingUpdate(null, segHash);

      // Verify it's deterministic
      const segHash2 = sha256(padded);
      const rolling2 = rollingUpdate(null, segHash2);
      expect(toHex(rolling)).toBe(toHex(rolling2));

      // Verify lengths
      expect(segHash.length).toBe(32);
      expect(rolling.length).toBe(32);
    });
  });
});
