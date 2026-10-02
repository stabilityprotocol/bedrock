const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Current blockchain network the UI is targeting. Persisted in localStorage
 * so it survives reloads. Every backend call should include this as the
 * `X-Network` header — see networkHeaders().
 */
export function getNetwork() {
  try {
    return localStorage.getItem('bedrock-network') || 'testnet';
  } catch {
    return 'testnet';
  }
}

export function setNetwork(name) {
  try {
    localStorage.setItem('bedrock-network', name);
    window.dispatchEvent(new CustomEvent('bedrock-network-change', { detail: name }));
  } catch {
    // noop
  }
}

export function networkHeaders() {
  return { 'X-Network': getNetwork() };
}

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(path, { ...fetchOptions, signal: controller.signal });
    if (!res.ok) {
      let body;
      try { body = await res.json(); } catch { body = null; }
      throw new ApiError(body?.error || `Request failed: ${res.status}`, res.status, body);
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError('Request timed out', 0, null);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: (path, options) => request(path, { method: 'GET', ...options }),
  post: (path, body, options) => request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...options,
  }),
  postForm: (path, formData, options) => request(path, {
    method: 'POST',
    body: formData,
    ...options,
  }),

  // AWS Rekognition Liveness
  createLivenessSession: () => request('/api/liveness/session', { method: 'POST' }),
  getLivenessResult: (sessionId) => request('/api/liveness/session/' + sessionId + '/result'),
};

export { ApiError };
