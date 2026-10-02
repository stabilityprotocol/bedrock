async function sleep(ms) {
  if (!ms || ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter.
 * Formula: baseDelay * 2^(attempt-1) * (0.5 + random(0, 0.5))
 */
function backoffDelay(baseDelayMs, attempt) {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(exponential * jitter);
}

async function withRetry(operation, options = {}) {
  const {
    stepName = 'operation',
    maxRetries = 3,
    retryDelayMs = 1000,
    shouldRetry = () => true
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const retryable = shouldRetry(error, attempt);
      if (!retryable || attempt >= maxRetries) {
        throw error;
      }
      const delay = backoffDelay(retryDelayMs, attempt);
      console.log(
        `[retry] ${stepName} failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

async function runStep(stepName, operation, options = {}) {
  const result = await withRetry(operation, {
    stepName,
    maxRetries: options.maxRetries || 3,
    retryDelayMs: options.retryDelayMs || 1000,
    shouldRetry: options.shouldRetry || (() => true)
  });
  return result;
}

export { sleep, withRetry, runStep, backoffDelay };
