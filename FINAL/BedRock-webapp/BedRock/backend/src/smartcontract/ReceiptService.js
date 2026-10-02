async function awaitReceipt(provider, transactionHash, options = {}) {
  const verificationStep = options.verificationStep || 'Receipt';
  const hashLabel = options.hashLabel || 'transaction';
  const timeoutMs = options.timeoutMs || 30000;
  const confirmations = options.confirmations ?? 1;
  const pollIntervalMs = options.pollIntervalMs || 200;
  const signal = options.signal || null;

  const startTime = Date.now();
  let receipt = null;
  let lastCheckedBlock = null;

  while (Date.now() - startTime < timeoutMs) {
    // Stop polling immediately if the job was aborted (timeout or cancellation)
    if (signal?.aborted) {
      const abortError = new Error(
        `${verificationStep}: Aborted while waiting for ${hashLabel} receipt (tx=${transactionHash})`
      );
      abortError.code = 'RECEIPT_ABORTED';
      throw abortError;
    }

    try {
      receipt = await provider.getTransactionReceipt(transactionHash);
      if (receipt) {
        if (confirmations <= 0) {
          break;
        }

        const currentBlockNumber = await provider.getBlockNumber();
        const confirmationsCount = currentBlockNumber - receipt.blockNumber + 1;
        if (confirmationsCount >= confirmations) {
          break;
        }

        // If no new block has been mined, avoid repeated confirmation checks immediately.
        if (lastCheckedBlock === currentBlockNumber) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          continue;
        }
        lastCheckedBlock = currentBlockNumber;
      }
    } catch (error) {
      // Treat transient RPC errors as a not-yet-mined receipt:
      // - CALL_EXCEPTION / "not found" / "transaction hash" — receipt doesn't exist yet
      // - SERVER_ERROR / 502 / 503 / 504 — RPC node temporary failure
      const message = error?.message || '';
      const isTransient =
        error?.code === 'CALL_EXCEPTION' ||
        error?.code === 'SERVER_ERROR' ||
        message.includes('not found') ||
        message.includes('transaction hash') ||
        message.includes('Gateway Timeout') ||
        message.includes('Bad Gateway') ||
        message.includes('Service Unavailable');

      if (!isTransient) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  if (!receipt) {
    const timeoutError = new Error(
      `${verificationStep}: Timed out waiting for ${hashLabel} receipt (tx=${transactionHash})`
    );
    timeoutError.code = 'RECEIPT_TIMEOUT';
    throw timeoutError;
  }

  if (receipt.status === 1) {
    return receipt;
  }

  const statusZeroError = new Error(
    `${verificationStep}: Receipt status is 0 for ${hashLabel} tx ${transactionHash}`
  );
  statusZeroError.code = 'RECEIPT_STATUS_0';
  statusZeroError.receiptStatus = receipt.status;
  throw statusZeroError;
}

export { awaitReceipt };
