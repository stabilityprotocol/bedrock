/**
 * Blockchain Writer — writes each rolling hash to the Subcontract on-chain.
 *
 * Two-step sequence per hash job:
 *   6a — addCumulativeHashDirect: submit the real transaction
 *   6b — awaitReceipt + parse HashRecorded event to validate the emitted hash
 *
 * After the final hash (isFinalHash === true):
 *   - Sets verify:<address> in Redis to { status: 'complete' }
 *
 * Notes:
 *   - Grandfather.updateRegistry() fires internally on-chain — no app-layer call needed
 *   - ReceiptService.awaitReceipt() enforces receipt.status === 1 (catches reverts); HashRecorded
 *     log parsing is done explicitly here
 */

import { buildProvider, buildSigner, buildContract } from "./smartcontract/ZgtEthersFactory.js";
import { SubcontractABI } from "./smartcontract/abi.js";
import SubcontractService from "./smartcontract/SubcontractService.js";
import { awaitReceipt } from "./smartcontract/ReceiptService.js";
import { redis } from "./index.js";


// ── Cached ethers context — reused across all jobs ──────────────────────────
// The queue worker processes jobs sequentially (concurrency=1), so a single
// cached provider/signer is safe. Contracts are cached per subcontract address.
// Provider and signer are created eagerly so the first job doesn't pay the
// network detection cost (~3s extra RPC call for eth_chainId).
const cachedProvider = buildProvider();
const cachedSigner = buildSigner(cachedProvider);
const contractCache = new Map();

// Warm up: trigger eth_chainId now so it's cached before the first job arrives.
cachedProvider.getNetwork().then(
  (net) => console.log("[blockchain-writer] Provider warmed up | chainId=" + net.chainId),
  (err) => console.warn("[blockchain-writer] Provider warm-up failed:", err.message)
);

function getProvider() {
  return cachedProvider;
}

function getSigner() {
  return cachedSigner;
}

function getContract(address) {
  if (!contractCache.has(address)) {
    contractCache.set(address, buildContract(address, SubcontractABI, getSigner()));
  }
  return contractCache.get(address);
}

/**
 * Write a single hash record to the Subcontract on-chain.
 *
 * @param {Object} hashRecord
 * @param {string}  hashRecord.subcontractAddress  - Deployed subcontract address
 * @param {number}  hashRecord.index               - Segment index (0 = genesis/isFirst)
 * @param {string}  hashRecord.segHashHex          - SHA-256 of the segment (hex, no 0x prefix)
 * @param {string}  hashRecord.rollingHex          - Rolling hash at this segment (hex, no 0x prefix)
 * @param {number}  hashRecord.timestamp           - Unix ms when the hash was produced
 * @param {string}  [hashRecord.recordingId]       - Recording session ID
 * @param {string}  [hashRecord.type]              - "genesis" for segment 0
 * @param {boolean} [hashRecord.isFinalHash]       - true for the last segment of the recording
 */
export async function writeHashToBlockchain(hashRecord, { signal } = {}) {
  const { subcontractAddress, rollingHex, index, isFinalHash } = hashRecord;

  // bytes32 format expected by the contract
  const hash = "0x" + rollingHex;
  const isFirst = index === 0;
  const isFinal = isFinalHash === true;

  // ── Build ethers context (cached) ───────────────────────────────────────────
  const provider = getProvider();
  const contract = getContract(subcontractAddress);

  console.log(
    "[blockchain-writer] seg=" + index +
    " | addr=" + subcontractAddress.slice(0, 10) + "…" +
    " | hash=" + hash.slice(0, 18) + "…" +
    (isFirst ? " | isFirst" : "") +
    (isFinal ? " | isFinal" : "")
  );

  const t0 = Date.now();

  // ── Step 6a — Submit real transaction ──────────────────────────────────────
  // Grandfather.updateRegistry() fires internally on-chain for isFirst/isFinal — no app call needed.
  const tSubmitStart = Date.now();
  const { txHash } = await SubcontractService.addCumulativeHashDirect(
    contract,
    hash,
    { isFinal, isFirst }
  );
  const submitMs = Date.now() - tSubmitStart;

  console.log(
    "[blockchain-writer] tx submitted: " + txHash +
    " | seg=" + index
  );

  // ── Step 6b — Await receipt + validate HashRecorded event ──────────────────
  const tReceiptStart = Date.now();
  const receipt = await awaitReceipt(provider, txHash, {
    verificationStep: "blockchain-writer",
    hashLabel: "seg=" + index,
    timeoutMs: 60000,
    pollIntervalMs: 200,
    signal,
  });
  const receiptMs = Date.now() - tReceiptStart;
  const totalMs = Date.now() - t0;

  console.log(
    "[blockchain-writer] \u23F1 seg=" + index +
    " | submit=" + submitMs + "ms" +
    " | receipt=" + receiptMs + "ms" +
    " | total=" + totalMs + "ms"
  );

  // Parse logs to find the HashRecorded event emitted by the Subcontract.
  // HashRecorded(bytes32 indexed previousHash, bytes32 indexed newHash, uint256 indexed sequence)
  const hashRecordedLog = receipt.logs
    .map((log) => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    })
    .find((parsed) => parsed?.name === "HashRecorded");

  if (!hashRecordedLog) {
    throw new Error(
      "[blockchain-writer] HashRecorded event not found in receipt for tx " + txHash
    );
  }

  const emittedHash = hashRecordedLog.args.newHash ?? hashRecordedLog.args[1];
  if (emittedHash.toLowerCase() !== hash.toLowerCase()) {
    throw new Error(
      "[blockchain-writer] HashRecorded mismatch — expected " + hash +
      ", got " + emittedHash + " (tx=" + txHash + ")"
    );
  }

  console.log(
    "[blockchain-writer] HashRecorded validated ✓ | seg=" + index +
    " | tx=" + txHash
  );

  // ── After final hash — mark as complete ─────────────────────────────────────
  if (isFinal) {
    await redis.set(
      "verify:" + subcontractAddress,
      JSON.stringify({ status: "complete" })
    );
    console.log(
      "[blockchain-writer] Final hash written ✓ | " + subcontractAddress
    );
  }
}
