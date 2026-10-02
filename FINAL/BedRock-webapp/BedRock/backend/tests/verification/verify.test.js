import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyVideo } from '../../src/verification/verify.js';

// Mock chain-reader — verify.js uses readOnChainSummary + readOnChainTrailEvents
vi.mock('../../src/verification/chain-reader.js', () => ({
  readOnChainSummary: vi.fn(),
  readOnChainTrailEvents: vi.fn(),
}));

import { readOnChainSummary, readOnChainTrailEvents } from '../../src/verification/chain-reader.js';
import { hashVideoBuffer } from '../../src/verification/video-hasher.js';
import { SEG_SIZE } from '../../src/verification/hashing.js';

const BASE_SUMMARY = {
  isAuthorizedChild: true,
  owner: '0xOwner',
  grandfatherAddress: '0xGF',
  totalEntries: 1,
  isInitialized: true,
  isFinalized: true,
  deploymentBlock: 100,
  registryFirstHash: null,
  registryFinalHash: null,
};

describe('verify orchestrator', () => {
  beforeEach(() => {
    readOnChainSummary.mockReset();
    readOnChainTrailEvents.mockReset();
  });

  it('should return verified=true via fast path when registry finalHash matches calculated', async () => {
    const fileBuffer = Buffer.alloc(100, 0x42);
    const { records } = hashVideoBuffer(fileBuffer);
    const finalHex = records[records.length - 1].rollingHex;

    readOnChainSummary.mockResolvedValue({
      ...BASE_SUMMARY,
      totalEntries: records.length,
      registryFirstHash: '0x' + records[0].rollingHex,
      registryFinalHash: '0x' + finalHex,
    });

    const result = await verifyVideo(fileBuffer, {
      subcontract: {},
      grandfather: {},
      subcontractAddress: '0xSC',
    });

    expect(result.verified).toBe(true);
    expect(result.tampering).toBeNull();
    expect(result.totalSegments).toBe(1);
    // Fast path: no event trail query should happen
    expect(readOnChainTrailEvents).not.toHaveBeenCalled();
  });

  it('should return verified=false when finalHash differs (falls through to trail)', async () => {
    const fileBuffer = Buffer.alloc(100, 0x42);

    readOnChainSummary.mockResolvedValue({
      ...BASE_SUMMARY,
      totalEntries: 1,
      registryFirstHash: '0x' + 'ff'.repeat(32),
      registryFinalHash: '0x' + 'ff'.repeat(32), // doesn't match calculated
    });

    readOnChainTrailEvents.mockResolvedValue({
      trail: [{
        previousHash: '0x' + '00'.repeat(32),
        newHash: '0x' + 'ff'.repeat(32),
        sequence: 0,
        blockNumber: 100,
        transactionHash: '0xtx0',
      }],
    });

    const result = await verifyVideo(fileBuffer, {
      subcontract: {},
      grandfather: {},
      subcontractAddress: '0xSC',
    });

    expect(result.verified).toBe(false);
    expect(result.tampering).not.toBeNull();
    expect(result.tampering.divergenceSegmentIndex).toBe(0);
    expect(readOnChainTrailEvents).toHaveBeenCalledOnce();
  });

  it('should propagate authorization errors from chain-reader', async () => {
    readOnChainSummary.mockRejectedValue(new Error('not an authorized child'));

    const fileBuffer = Buffer.alloc(100, 0x42);
    await expect(
      verifyVideo(fileBuffer, { subcontract: {}, grandfather: {}, subcontractAddress: '0xSC' })
    ).rejects.toThrow('not an authorized child');
  });

  it('should include subcontractInfo in result', async () => {
    const fileBuffer = Buffer.alloc(100, 0x42);
    const { records } = hashVideoBuffer(fileBuffer);
    const finalHex = records[records.length - 1].rollingHex;

    readOnChainSummary.mockResolvedValue({
      isAuthorizedChild: true,
      owner: '0xOwnerAddr',
      grandfatherAddress: '0xGFAddr',
      totalEntries: 1,
      isInitialized: true,
      isFinalized: true,
      deploymentBlock: 42,
      registryFirstHash: '0x' + records[0].rollingHex,
      registryFinalHash: '0x' + finalHex,
    });

    const result = await verifyVideo(fileBuffer, {
      subcontract: {},
      grandfather: {},
      subcontractAddress: '0xSC',
    });

    expect(result.subcontractInfo.owner).toBe('0xOwnerAddr');
    expect(result.subcontractInfo.isFinalized).toBe(true);
    expect(result.subcontractInfo.totalEntries).toBe(1);
    expect(result.subcontractInfo.deploymentBlock).toBe(42);
  });

  it('should pass videoDurationSeconds through to comparator on the tamper path', async () => {
    const fileBuffer = Buffer.alloc(SEG_SIZE + 100, 0x42); // 2 segments
    const { records } = hashVideoBuffer(fileBuffer);

    // Second segment hash differs on-chain
    const trail = records.map((r, i) => ({
      previousHash: '0x' + '00'.repeat(32),
      newHash: i === 1 ? '0x' + 'ff'.repeat(32) : '0x' + r.rollingHex,
      sequence: i,
      blockNumber: 100 + i,
      transactionHash: '0xtx' + i,
    }));

    readOnChainSummary.mockResolvedValue({
      ...BASE_SUMMARY,
      totalEntries: 2,
      registryFirstHash: '0x' + records[0].rollingHex,
      registryFinalHash: '0x' + 'ff'.repeat(32), // mismatch → slow path
    });
    readOnChainTrailEvents.mockResolvedValue({ trail });

    const result = await verifyVideo(fileBuffer, {
      subcontract: {},
      grandfather: {},
      subcontractAddress: '0xSC',
      videoDurationSeconds: 60,
    });

    expect(result.verified).toBe(false);
    expect(result.tampering.approximateSecond).toBe(30); // seg 1 of 2, 60s total
  });
});
