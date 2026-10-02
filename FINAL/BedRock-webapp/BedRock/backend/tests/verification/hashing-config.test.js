import { describe, it, expect } from 'vitest';
import { SEG_SIZE } from '../../src/verification/hashing.js';

describe('SEG_SIZE configuration', () => {
  it('defaults to 1.25MB when env var is not set', () => {
    expect(SEG_SIZE).toBe(1_310_720);
  });

  it('is a positive integer', () => {
    expect(Number.isInteger(SEG_SIZE)).toBe(true);
    expect(SEG_SIZE).toBeGreaterThan(0);
  });
});
