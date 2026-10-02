/**
 * blockchain-writer.js — Writes each rolling hash to the Subcontract on-chain.
 *
 * Adapted from backend blockchain-writer.js for direct Pi → Stability usage.
 * No Redis or deployInfo dependency — subcontract address comes from job data.
 *
 * Three-step sequence per hash:
 *   1. staticCall preflight (catch reverts before spending gas)
 *   2. submit real addCumulativeHash transaction
 *   3. await receipt + validate HashRecorded event
 */

import { buildProvider, buildSigner, buildContract, getGaslessTxOverrides } from "./smartcontract/ethers-factory.js";
import { SubcontractABI } from "./smartcontract/abi.js";
import { awaitReceipt } from "./smartcontract/receipt-service.js";

// ── Cached ethers context — reused across all jobs (concurrency=1) ───────────
let cachedProvider = null;
let cachedSigner = null;
const contractCache = new Map();

function getProvider() {
  if (!cachedProvider) cachedProvider = buildProvider();
  return cachedProvider;
}

function getSigner() {
  if (!cachedSigner) cachedSigner = buildSigner(getProvider());
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
 * @param {string}  hashRecord.subcontractAddress - Deployed subcontract address
 * @param {number}  hashRecord.index              - Segment index (0 = genesis)
 * @param {string}  hashRecord.rollingHex         - Rolling hash (hex, no 0x prefix)
 * @param {boolean} hashRecord.isFirst            - true for segment 0
 * @param {boolean} hashRecord.isFinal            - true for last segment
 */
export async function writeHashToBlockchain(hashRecord) {
  const { subcontractAddress, rollingHex, index, isFirst, isFinal } = hashRecord;

  // bytes32 format expected by the contract
  const hash = "0x" + rollingHex;

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

  // ── Step 1 — staticCall preflight ───────────────────────────────────────────
  const tStaticStart = Date.now();
  try {
    await contract.addCumulativeHash.staticCall(hash, isFinal, isFirst);
  } catch (err) {
    throw new Error(
      "[blockchain-writer] staticCall preflight failed (seg=" + index + "): " + err.message
    );
  }
  const staticMs = Date.now() - tStaticStart;

  // ── Step 2 — Submit real transaction ────────────────────────────────────────
  const tSubmitStart = Date.now();
  const overrides = getGaslessTxOverrides({}, 1_500_000n);
  const tx = await contract.addCumulativeHash(hash, isFinal, isFirst, overrides);
  const txHash = tx.hash;
  const submitMs = Date.now() - tSubmitStart;

  console.log("[blockchain-writer] tx submitted: " + txHash + " | seg=" + index);

  // ── Step 3 — Await receipt + validate HashRecorded event ────────────────────
  const tReceiptStart = Date.now();
  const receipt = await awaitReceipt(provider, txHash, {
    verificationStep: "blockchain-writer",
    hashLabel: "seg=" + index,
    timeoutMs: 60_000,
    pollIntervalMs: 150,
  });
  const receiptMs = Date.now() - tReceiptStart;
  const totalMs = Date.now() - t0;

  console.log(
    "[blockchain-writer] ⏱ seg=" + index +
    " | static=" + staticMs + "ms" +
    " | submit=" + submitMs + "ms" +
    " | receipt=" + receiptMs + "ms" +
    " | total=" + totalMs + "ms"
  );

  // Parse HashRecorded event from receipt logs
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

  return { txHash, receipt };
}
