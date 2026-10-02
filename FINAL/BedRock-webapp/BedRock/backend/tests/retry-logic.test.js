import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/smartcontract/RetryLogicService.js';

describe('withRetry', () => {
  it('succeeds on first attempt without delay', async () => {
    const op = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(op, { maxRetries: 3 });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const op = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok');
    const result = await withRetry(op, { maxRetries: 3, retryDelayMs: 10 });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('applies exponential backoff between retries', async () => {
    const delays = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms) => {
      delays.push(ms);
      return originalSetTimeout(fn, 0);
    });

    const op = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    await withRetry(op, { maxRetries: 3, retryDelayMs: 100 });

    expect(delays.length).toBe(2);
    expect(delays[0]).toBeGreaterThan(0);
    // With backoff, delay[1] is ~200 * jitter > delay[0] ~100 * jitter
    expect(delays[1]).toBeGreaterThan(delays[0]);

    vi.restoreAllMocks();
  });

  it('throws after max retries exhausted', async () => {
    const op = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(
      withRetry(op, { maxRetries: 2, retryDelayMs: 10 })
    ).rejects.toThrow('always fails');
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('respects shouldRetry predicate', async () => {
    const nonRetryable = new Error('permanent');
    nonRetryable.code = 'PERMANENT';
    const op = vi.fn().mockRejectedValue(nonRetryable);

    await expect(
      withRetry(op, {
        maxRetries: 3,
        retryDelayMs: 10,
        shouldRetry: (err) => err.code !== 'PERMANENT',
      })
    ).rejects.toThrow('permanent');
    expect(op).toHaveBeenCalledTimes(1);
  });
});
