/**
 * On-Chain Hash Trail Reader
 *
 * Exposes three functions:
 *   readOnChainSummary      — auth check + subcontract state + grandfather registry (no events)
 *   readOnChainTrailEvents  — paginated HashRecorded event query with retry
 *   readOnChainTrail        — composition of the two (back-compat)
 *
 * Verification uses readOnChainSummary alone for the fast "Verified" path:
 * the Grandfather registry stores the final rolling hash directly, so a
 * Verified outcome can be decided without querying any events.
 *
 * NOTE: Stability Protocol's RPC has eventually-consistent event indexing.
 * State variables (totalEntries, isFinalized) update immediately, but
 * getLogs/queryFilter results may lag. The trail-events reader retries
 * when event count doesn't match totalEntries (up to 10 attempts with
 * exponential backoff, 1s-8s).
 */

const EVENT_RETRY_MAX = 10;
const EVENT_RETRY_BASE_DELAY_MS = 1000;
const EVENT_RETRY_MAX_DELAY_MS = 8000;
const MAX_BLOCK_RANGE = 25_000;

/**
 * Read subcontract state and grandfather registry for a subcontract.
 * Performs the authorization check and returns every field except `trail`.
 *
 * @param {Object} params
 * @param {import('ethers').Contract} params.subcontract
 * @param {import('ethers').Contract} params.grandfather
 * @param {string} params.subcontractAddress
 * @returns {Promise<{
 *   isAuthorizedChild: boolean,
 *   owner: string,
 *   grandfatherAddress: string,
 *   totalEntries: number,
 *   isInitialized: boolean,
 *   isFinalized: boolean,
 *   deploymentBlock: number,
 *   registryFirstHash: string|null,
 *   registryFinalHash: string|null,
 * }>}
 */
export async function readOnChainSummary({ subcontract, grandfather, subcontractAddress }) {
  const isAuthorized = await grandfather.isAuthorizedChild(subcontractAddress);
  if (!isAuthorized) {
    throw new Error(
      `Subcontract ${subcontractAddress} is not an authorized child of the Grandfather contract`
    );
  }

  const [owner, grandfatherAddress, totalEntriesBig, isInitialized, isFinalized, deploymentBlockBig, registry] =
    await Promise.all([
      subcontract.owner(),
      subcontract.grandfather(),
      subcontract.totalEntries(),
      subcontract.isInitialized(),
      subcontract.isFinalized(),
      subcontract.deploymentBlock(),
      grandfather.registry(subcontractAddress),
    ]);

  return {
    isAuthorizedChild: true,
    owner,
    grandfatherAddress,
    totalEntries: Number(totalEntriesBig),
    isInitialized,
    isFinalized,
    deploymentBlock: Number(deploymentBlockBig),
    registryFirstHash: registry?.firstHash ?? null,
    registryFinalHash: registry?.finalHash ?? null,
  };
}

/**
 * Query all HashRecorded events for a subcontract, paginated with retry.
 *
 * @param {Object} params
 * @param {import('ethers').Contract} params.subcontract
 * @param {number} params.deploymentBlock
 * @param {number} params.totalEntries
 * @returns {Promise<{
 *   trail: Array<{ previousHash: string, newHash: string, sequence: number, blockNumber: number, transactionHash: string }>,
 * }>}
 */
export async function readOnChainTrailEvents({ subcontract, deploymentBlock, totalEntries }) {
  const provider = subcontract.runner?.provider ?? subcontract.provider;
  let hashEvents = [];

  for (let attempt = 1; attempt <= EVENT_RETRY_MAX; attempt++) {
    const latestBlock = await provider.getBlockNumber();
    hashEvents = [];

    console.log(
      '[chain-reader] Querying events (attempt %d/%d): deploymentBlock=%d latestBlock=%d range=%d',
      attempt, EVENT_RETRY_MAX, deploymentBlock, latestBlock, latestBlock - deploymentBlock
    );

    for (let from = deploymentBlock; from <= latestBlock; from += MAX_BLOCK_RANGE + 1) {
      const to = Math.min(from + MAX_BLOCK_RANGE, latestBlock);
      const chunk = await subcontract.queryFilter(
        subcontract.filters.HashRecorded(),
        from,
        to
      );
      hashEvents.push(...chunk);
    }

    console.log('[chain-reader] Found %d events (expected: %d)', hashEvents.length, totalEntries);

    if (hashEvents.length >= totalEntries || totalEntries === 0) {
      break;
    }

    if (attempt < EVENT_RETRY_MAX) {
      const delay = Math.min(EVENT_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), EVENT_RETRY_MAX_DELAY_MS);
      console.log(
        '[chain-reader] Event count mismatch — RPC log index may be lagging. Retrying in %ds...',
        delay / 1000
      );
      await new Promise((r) => setTimeout(r, delay));
    } else {
      console.warn(
        '[chain-reader] WARNING: Still only found %d/%d events after %d attempts. Proceeding with available data.',
        hashEvents.length, totalEntries, EVENT_RETRY_MAX
      );
    }
  }

  const trail = hashEvents
    .map((event) => ({
      previousHash: event.args?.previousHash ?? event.args?.[0],
      newHash: event.args?.newHash ?? event.args?.[1],
      sequence: Number(event.args?.sequence ?? event.args?.[2]),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
    }))
    .sort((a, b) => a.sequence - b.sequence);

  return { trail };
}

/**
 * Back-compat composition: summary + trail events.
 *
 * @param {Object} params
 * @param {import('ethers').Contract} params.subcontract
 * @param {import('ethers').Contract} params.grandfather
 * @param {string} params.subcontractAddress
 */
export async function readOnChainTrail({ subcontract, grandfather, subcontractAddress }) {
  const summary = await readOnChainSummary({ subcontract, grandfather, subcontractAddress });
  const { trail } = await readOnChainTrailEvents({
    subcontract,
    deploymentBlock: summary.deploymentBlock,
    totalEntries: summary.totalEntries,
  });
  return { ...summary, trail };
}
