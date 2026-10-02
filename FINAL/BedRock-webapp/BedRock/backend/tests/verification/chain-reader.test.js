import { describe, it, expect, vi } from 'vitest';
import { readOnChainTrail } from '../../src/verification/chain-reader.js';

// Helper: create a mock subcontract
function mockSubcontract({ totalEntries = 3, isInitialized = true, isFinalized = true, deploymentBlock = 100, hashEvents = [] } = {}) {
  const filters = {
    HashRecorded: () => 'HashRecorded_filter',
    Initialized: () => 'Initialized_filter',
    Finalized: () => 'Finalized_filter',
  };

  return {
    owner: vi.fn().mockResolvedValue('0xOwnerAddress'),
    grandfather: vi.fn().mockResolvedValue('0xGrandfatherAddress'),
    totalEntries: vi.fn().mockResolvedValue(BigInt(totalEntries)),
    isInitialized: vi.fn().mockResolvedValue(isInitialized),
    isFinalized: vi.fn().mockResolvedValue(isFinalized),
    deploymentBlock: vi.fn().mockResolvedValue(BigInt(deploymentBlock)),
    filters,
    queryFilter: vi.fn().mockImplementation((filter) => {
      if (filter === 'HashRecorded_filter') return Promise.resolve(hashEvents);
      return Promise.resolve([]);
    }),
    runner: { provider: { getBlockNumber: vi.fn().mockResolvedValue(200) } },
  };
}

// Helper: create a mock grandfather
function mockGrandfather({ isAuthorized = true } = {}) {
  return {
    isAuthorizedChild: vi.fn().mockResolvedValue(isAuthorized),
    registry: vi.fn().mockResolvedValue({
      firstHash: '0x' + 'aa'.repeat(32),
      finalHash: '0x' + 'bb'.repeat(32),
    }),
  };
}

// Helper: create mock HashRecorded events
function makeHashEvents(hashes) {
  return hashes.map((hash, i) => ({
    args: {
      previousHash: i === 0 ? '0x' + '00'.repeat(32) : hashes[i - 1],
      newHash: hash,
      sequence: BigInt(i),
    },
    blockNumber: 100 + i,
    transactionHash: '0xtx' + i,
  }));
}

describe('chain-reader', () => {
  describe('readOnChainTrail', () => {
    it('should reject if subcontract is not an authorized child', async () => {
      const grandfather = mockGrandfather({ isAuthorized: false });
      const subcontract = mockSubcontract();

      await expect(
        readOnChainTrail({ subcontract, grandfather, subcontractAddress: '0xSC' })
      ).rejects.toThrow('not an authorized child');
    });

    it('should return trail with correct structure for authorized subcontract', async () => {
      const hashes = [
        '0x' + 'aa'.repeat(32),
        '0x' + 'bb'.repeat(32),
        '0x' + 'cc'.repeat(32),
      ];
      const hashEvents = makeHashEvents(hashes);
      const grandfather = mockGrandfather();
      const subcontract = mockSubcontract({ hashEvents, totalEntries: 3 });

      const result = await readOnChainTrail({ subcontract, grandfather, subcontractAddress: '0xSC' });

      expect(result.isAuthorizedChild).toBe(true);
      expect(result.totalEntries).toBe(3);
      expect(result.isInitialized).toBe(true);
      expect(result.isFinalized).toBe(true);
      expect(result.trail).toHaveLength(3);
    });

    it('should return trail entries sorted by sequence', async () => {
      const hashes = ['0x' + 'aa'.repeat(32), '0x' + 'bb'.repeat(32)];
      const hashEvents = makeHashEvents(hashes).reverse(); // reversed!
      const grandfather = mockGrandfather();
      const subcontract = mockSubcontract({ hashEvents, totalEntries: 2 });

      const result = await readOnChainTrail({ subcontract, grandfather, subcontractAddress: '0xSC' });

      expect(result.trail[0].sequence).toBe(0);
      expect(result.trail[1].sequence).toBe(1);
    });

    it('should extract newHash from each trail entry', async () => {
      const hashes = ['0x' + 'ff'.repeat(32)];
      const hashEvents = makeHashEvents(hashes);
      const grandfather = mockGrandfather();
      const subcontract = mockSubcontract({ hashEvents, totalEntries: 1 });

      const result = await readOnChainTrail({ subcontract, grandfather, subcontractAddress: '0xSC' });

      expect(result.trail[0].newHash).toBe('0x' + 'ff'.repeat(32));
      expect(result.trail[0].sequence).toBe(0);
    });

    it('should include registry hashes from grandfather', async () => {
      const hashes = ['0x' + 'aa'.repeat(32)];
      const hashEvents = makeHashEvents(hashes);
      const grandfather = mockGrandfather();
      const subcontract = mockSubcontract({ hashEvents, totalEntries: 1 });

      const result = await readOnChainTrail({ subcontract, grandfather, subcontractAddress: '0xSC' });

      expect(result.registryFirstHash).toBe('0x' + 'aa'.repeat(32));
      expect(result.registryFinalHash).toBe('0x' + 'bb'.repeat(32));
    });

    it('should handle subcontract with no entries', async () => {
      const grandfather = mockGrandfather();
      const subcontract = mockSubcontract({
        hashEvents: [],
        totalEntries: 0,
        isInitialized: false,
        isFinalized: false,
      });

      const result = await readOnChainTrail({ subcontract, grandfather, subcontractAddress: '0xSC' });

      expect(result.trail).toHaveLength(0);
      expect(result.totalEntries).toBe(0);
    });

    it('should include owner and grandfatherAddress in result', async () => {
      const grandfather = mockGrandfather();
      const subcontract = mockSubcontract({ hashEvents: [], totalEntries: 0 });

      const result = await readOnChainTrail({ subcontract, grandfather, subcontractAddress: '0xSC' });

      expect(result.owner).toBe('0xOwnerAddress');
      expect(result.grandfatherAddress).toBe('0xGrandfatherAddress');
    });

    it('should include deploymentBlock in result', async () => {
      const grandfather = mockGrandfather();
      const subcontract = mockSubcontract({ deploymentBlock: 42, hashEvents: [], totalEntries: 0 });

      const result = await readOnChainTrail({ subcontract, grandfather, subcontractAddress: '0xSC' });

      expect(result.deploymentBlock).toBe(42);
    });

    it('should include blockNumber and transactionHash in trail entries', async () => {
      const hashes = ['0x' + 'dd'.repeat(32)];
      const hashEvents = makeHashEvents(hashes);
      const grandfather = mockGrandfather();
      const subcontract = mockSubcontract({ hashEvents, totalEntries: 1 });

      const result = await readOnChainTrail({ subcontract, grandfather, subcontractAddress: '0xSC' });

      expect(result.trail[0].blockNumber).toBe(100);
      expect(result.trail[0].transactionHash).toBe('0xtx0');
    });
  });
});
