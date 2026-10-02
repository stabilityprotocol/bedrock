import { getGaslessTxOverrides } from './ZgtEthersFactory.js';

const SubcontractService = {};

/**
 * Direct ethers write helper: addCumulativeHash without ZKT queue polling.
 * @param {import('ethers').Contract} subcontractContract
 * @param {string} hash bytes32 hex string
 * @param {Object} [options={}]
 * @param {boolean} [options.isFinal=false]
 * @param {boolean} [options.isFirst=false]
 * @param {Object} [options.txOverrides={}]
 * @returns {Promise<{txHash: string, tx: Object}>}
 */
SubcontractService.addCumulativeHashDirect = async function addCumulativeHashDirect(subcontractContract, hash, options = {}) {
  const {
    isFinal = false,
    isFirst = false,
    txOverrides = {}
  } = options;

  if (!subcontractContract || typeof subcontractContract.addCumulativeHash !== 'function') {
    throw new Error('Invalid subcontractContract passed to addCumulativeHashDirect');
  }

  if (!hash || typeof hash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error(`Invalid hash format. Expected bytes32 hex string. Got: ${hash}`);
  }

  const overrides = getGaslessTxOverrides(txOverrides, 1_500_000n);
  try {
    const tx = await subcontractContract.addCumulativeHash(hash, isFinal, isFirst, overrides);
    return {
      txHash: tx.hash,
      tx
    };
  } catch (error) {
    const action = error?.action || '';
    if (action === 'estimateGas') {
      throw new Error(
        `addCumulativeHash failed during gas estimation. ` +
        `Using gasless fees (0/0). Try increasing gasLimit in txOverrides (current=${overrides.gasLimit}). ` +
        `Original: ${error.message}`
      );
    }
    throw error;
  }
};

/**
 * Read current subcontract chain summary from on-chain state and events.
 * @param {import('ethers').Contract} subcontractContract
 * @param {Object} [options={}]
 * @param {number} [options.fromBlock=0]
 * @param {boolean} [options.requireComplete=false]
 * @returns {Promise<{
 *   owner: string,
 *   grandfather: string,
 *   totalEntries: string,
 *   isInitialized: boolean,
 *   isFinalized: boolean,
 *   firstHash: string|null,
 *   firstTxHash: string|null,
 *   finalHash: string|null,
 *   finalTxHash: string|null
 * }>}
 */
SubcontractService.getCumulativeHashSummary = async function getCumulativeHashSummary(subcontractContract, options = {}) {
  const requireComplete = options.requireComplete === true;
  const fromBlock = options.fromBlock ?? 0;
  const firstBlock = options.firstBlock;
  const finalBlock = options.finalBlock;

  const [owner, grandfather, totalEntries, isInitialized, isFinalized] = await Promise.all([
    subcontractContract.owner(),
    subcontractContract.grandfather(),
    subcontractContract.totalEntries(),
    subcontractContract.isInitialized(),
    subcontractContract.isFinalized()
  ]);

  // Query events using known block numbers (O(1) lookup - we know exactly where events are)
  let initializedEvents, finalizedEvents;

  if (firstBlock && finalBlock) {
    // O(1) lookup: Query exactly the blocks where events occurred (with small buffer for indexing delays)
    const buffer = 2;
    [initializedEvents, finalizedEvents] = await Promise.all([
      subcontractContract.queryFilter(subcontractContract.filters.Initialized(), Math.max(0, firstBlock - buffer), firstBlock + buffer),
      subcontractContract.queryFilter(subcontractContract.filters.Finalized(), Math.max(0, finalBlock - buffer), finalBlock + buffer)
    ]);
  } else {
    // Fallback: query from deployment block (less efficient, but works if blocks unknown)
    [initializedEvents, finalizedEvents] = await Promise.all([
      subcontractContract.queryFilter(subcontractContract.filters.Initialized(), fromBlock),
      subcontractContract.queryFilter(subcontractContract.filters.Finalized(), fromBlock)
    ]);
  }

  const firstInitialized = initializedEvents.length > 0 ? initializedEvents[0] : null;
  const lastFinalized = finalizedEvents.length > 0 ? finalizedEvents[finalizedEvents.length - 1] : null;
  const iface = subcontractContract.interface;

  function extractEventHash(log, eventName, argName) {
    if (!log) {
      return null;
    }

    // First attempt: parse via ABI for consistent ethers v6 behavior.
    if (iface && typeof iface.parseLog === 'function') {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === eventName) {
          return parsed.args?.[0] ?? parsed.args?.[argName] ?? null;
        }
      } catch (_) {
        // Fall through to direct args access.
      }
    }

    // Fallback: use queryFilter materialized args.
    return log.args?.[0] ?? log.args?.[argName] ?? null;
  }

  const summary = {
    owner,
    grandfather,
    totalEntries: totalEntries.toString(),
    isInitialized,
    isFinalized,
    firstHash: extractEventHash(firstInitialized, 'Initialized', 'firstHash'),
    firstTxHash: firstInitialized?.transactionHash ?? null,
    finalHash: extractEventHash(lastFinalized, 'Finalized', 'finalHash'),
    finalTxHash: lastFinalized?.transactionHash ?? null
  };

  if (requireComplete) {
    const missing = [];
    if (!summary.firstHash) missing.push('firstHash');
    if (!summary.firstTxHash) missing.push('firstTxHash');
    if (!summary.finalHash) missing.push('finalHash');
    if (!summary.finalTxHash) missing.push('finalTxHash');
    if (missing.length > 0) {
      const error = new Error(`On-chain summary incomplete: missing ${missing.join(', ')}`);
      error.code = 'SUMMARY_INCOMPLETE';
      throw error;
    }
  }

  return summary;
};

export default SubcontractService;
