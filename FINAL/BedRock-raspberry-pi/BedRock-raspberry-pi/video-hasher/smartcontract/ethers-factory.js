/**
 * Ethers.js helpers for Stability Protocol (gasless transactions).
 * Adapted from backend ZgtEthersFactory.js.
 */

import { ethers } from "ethers";

function getZgtRpcUrl(options = {}) {
  const apiKey = options.apiKey || process.env.API_KEY;
  const rpcBase = options.rpcBase || process.env.RPC_URL || "https://rpc.testnet.stabilityprotocol.com";

  if (!rpcBase) {
    throw new Error("RPC_URL is not configured");
  }

  return apiKey ? `${rpcBase}/zgt/${apiKey}` : rpcBase;
}

function buildProvider(options = {}) {
  const rpcUrl = options.rpcUrl || getZgtRpcUrl(options);
  return new ethers.JsonRpcProvider(rpcUrl);
}

function buildSigner(provider, options = {}) {
  const privateKey = options.privateKey || process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required");
  }
  return new ethers.Wallet(privateKey, provider);
}

function buildContract(address, abi, signerOrProvider) {
  return new ethers.Contract(address, abi, signerOrProvider);
}

/**
 * Stability Protocol uses gasless transactions — fees are always 0.
 */
function getGaslessTxOverrides(overrides = {}, defaultGasLimit = null) {
  const resolved = {
    ...overrides,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
  };

  if ((resolved.gasLimit === undefined || resolved.gasLimit === null) && defaultGasLimit !== null) {
    resolved.gasLimit = defaultGasLimit;
  }

  return resolved;
}

export { getZgtRpcUrl, buildProvider, buildSigner, buildContract, getGaslessTxOverrides };
