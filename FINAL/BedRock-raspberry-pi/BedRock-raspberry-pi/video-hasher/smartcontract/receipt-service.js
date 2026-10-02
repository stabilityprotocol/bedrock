/**
 * Transaction receipt polling with timeout and transient error handling.
 * Adapted from backend ReceiptService.js.
 */

async function awaitReceipt(provider, transactionHash, options = {}) {
  const verificationStep = options.verificationStep || "Receipt";
  const hashLabel = options.hashLabel || "transaction";
  const timeoutMs = options.timeoutMs || 30_000;
  const confirmations = options.confirmations ?? 1;
  const pollIntervalMs = options.pollIntervalMs || 150;

  const startTime = Date.now();
  let receipt = null;
  let lastCheckedBlock = null;

  while (Date.now() - startTime < timeoutMs) {
    try {
      receipt = await provider.getTransactionReceipt(transactionHash);
      if (receipt) {
        if (confirmations <= 0) break;

        const currentBlockNumber = await provider.getBlockNumber();
        const confirmationsCount = currentBlockNumber - receipt.blockNumber + 1;
        if (confirmationsCount >= confirmations) break;

        if (lastCheckedBlock === currentBlockNumber) {
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          continue;
        }
        lastCheckedBlock = currentBlockNumber;
      }
    } catch (error) {
      const message = error?.message || "";
      const isTransient =
        error?.code === "CALL_EXCEPTION" ||
        error?.code === "SERVER_ERROR" ||
        message.includes("not found") ||
        message.includes("transaction hash") ||
        message.includes("Gateway Timeout") ||
        message.includes("Bad Gateway") ||
        message.includes("Service Unavailable");

      if (!isTransient) throw error;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  if (!receipt) {
    const err = new Error(
      `${verificationStep}: Timed out waiting for ${hashLabel} receipt (tx=${transactionHash})`
    );
    err.code = "RECEIPT_TIMEOUT";
    throw err;
  }

  if (receipt.status === 1) return receipt;

  const err = new Error(
    `${verificationStep}: Receipt status is 0 for ${hashLabel} tx ${transactionHash}`
  );
  err.code = "RECEIPT_STATUS_0";
  throw err;
}

export { awaitReceipt };
