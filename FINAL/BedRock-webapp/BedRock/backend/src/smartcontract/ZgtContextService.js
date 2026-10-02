import { GrandfatherABI } from './abi.js';
import { getZgtRpcUrl, buildProvider, buildSigner, buildContract } from './ZgtEthersFactory.js';

let cachedContext = null;

function assertEnv() {
  if (!process.env.GRANDFATHER_ADDRESS) {
    throw new Error('GRANDFATHER_ADDRESS is required');
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is required');
  }
}

function createContext(options = {}) {
  assertEnv();
  const rpcUrl = options.rpcUrl || getZgtRpcUrl();
  const grandfatherAddress = options.grandfatherAddress || process.env.GRANDFATHER_ADDRESS;
  const provider = buildProvider({ rpcUrl });
  const signer = buildSigner(provider, { privateKey: options.privateKey || process.env.PRIVATE_KEY });
  const grandfatherContract = buildContract(grandfatherAddress, GrandfatherABI, signer);
  return { rpcUrl, provider, signer, grandfatherContract };
}

function getContext(options = {}) {
  if (!cachedContext) {
    cachedContext = createContext(options);
  }
  return cachedContext;
}

function resetContext() {
  cachedContext = null;
}

export { createContext, getContext, resetContext };
