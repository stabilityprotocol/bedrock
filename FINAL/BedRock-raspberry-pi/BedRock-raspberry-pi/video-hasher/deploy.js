/**
 * deploy.js — Standalone script to deploy a Subcontract via the Grandfather factory.
 *
 * Called by Python (blockchain.py) via subprocess:
 *   node deploy.js
 *
 * On success, prints JSON to stdout:
 *   { "subcontractAddress": "0x...", "deploymentBlock": 12345, "signerEoa": "0x..." }
 *
 * On failure, prints JSON to stdout with error field and exits with code 1:
 *   { "error": "reason..." }
 *
 * Requires .env (or environment variables):
 *   RPC_URL, API_KEY, PRIVATE_KEY, GRANDFATHER_ADDRESS
 */

import "dotenv/config";
import { ethers } from "ethers";
import { buildProvider, buildSigner, buildContract, getGaslessTxOverrides } from "./smartcontract/ethers-factory.js";
import { GrandfatherABI } from "./smartcontract/abi.js";
import { awaitReceipt } from "./smartcontract/receipt-service.js";

async function deploy() {
  const grandfatherAddress = process.env.GRANDFATHER_ADDRESS;
  if (!grandfatherAddress) {
    throw new Error("GRANDFATHER_ADDRESS is not set");
  }

  const provider = buildProvider();
  const signer = buildSigner(provider);
  const grandfather = buildContract(grandfatherAddress, GrandfatherABI, signer);

  console.error("[deploy] Deploying subcontract via Grandfather at " + grandfatherAddress);
  console.error("[deploy] Signer: " + signer.address);

  // Submit createSubcontract transaction (gasless)
  const overrides = getGaslessTxOverrides({}, 3_000_000n);
  const tx = await grandfather.createSubcontract(overrides);
  console.error("[deploy] tx submitted: " + tx.hash);

  // Wait for receipt
  const receipt = await awaitReceipt(provider, tx.hash, {
    verificationStep: "deploy",
    hashLabel: "createSubcontract",
    timeoutMs: 60_000,
    pollIntervalMs: 200,
  });

  // Extract subcontract address from SubcontractCreated event
  const iface = new ethers.Interface(GrandfatherABI);
  let subcontractAddress = null;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "SubcontractCreated") {
        subcontractAddress = parsed.args.subcontractAddress;
        break;
      }
    } catch {
      // Not our event — skip
    }
  }

  if (!subcontractAddress) {
    throw new Error("SubcontractCreated event not found in receipt");
  }

  console.error("[deploy] Subcontract deployed at " + subcontractAddress);

  // Output result as JSON to stdout (Python reads this)
  const result = {
    subcontractAddress,
    deploymentBlock: receipt.blockNumber,
    signerEoa: signer.address,
  };

  process.stdout.write(JSON.stringify(result) + "\n");
}

deploy().catch((err) => {
  process.stdout.write(JSON.stringify({ error: err.message }) + "\n");
  process.exit(1);
});
