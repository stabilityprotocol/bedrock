import { ethers } from 'ethers';
import { GrandfatherABI } from './abi.js';
import { getGaslessTxOverrides } from './ZgtEthersFactory.js';

const GrandfatherService = {};

/**
 * Direct ethers write helper: createSubcontract without ZKT queue polling.
 * @param {import('ethers').Contract} grandfatherContract
 * @param {Object} [txOverrides={}]
 * @returns {Promise<{txHash: string, tx: Object}>}
 */
GrandfatherService.createSubcontractDirect = async function createSubcontractDirect(grandfatherContract, txOverrides = {}) {
  if (!grandfatherContract || typeof grandfatherContract.createSubcontract !== 'function') {
    throw new Error('Invalid grandfatherContract passed to createSubcontractDirect');
  }

  const overrides = getGaslessTxOverrides(txOverrides, 3_000_000n);
  try {
    const tx = await grandfatherContract.createSubcontract(overrides);
    return { txHash: tx.hash, tx };
  } catch (error) {
    const action = error?.action || '';
    if (action === 'estimateGas') {
      throw new Error(
        `createSubcontract failed during gas estimation. ` +
        `Using gasless fees (0/0). Try increasing gasLimit in txOverrides (current=${overrides.gasLimit}). ` +
        `Original: ${error.message}`
      );
    }
    throw error;
  }
};

/**
 * Extract subcontract address from deployment receipt by decoding SubcontractCreated logs.
 * @param {Object} receipt
 * @returns {string}
 */
GrandfatherService.extractSubcontractAddressFromReceipt = function extractSubcontractAddressFromReceipt(receipt) {
  if (!receipt || !Array.isArray(receipt.logs)) {
    throw new Error('Invalid receipt passed to extractSubcontractAddressFromReceipt');
  }

  const iface = new ethers.Interface(GrandfatherABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === 'SubcontractCreated') {
        return parsed.args.subcontractAddress;
      }
    } catch (_) {
      // Ignore logs that are not from this ABI.
    }
  }

  throw new Error('SubcontractCreated event not found in transaction receipt');
};

export default GrandfatherService;
