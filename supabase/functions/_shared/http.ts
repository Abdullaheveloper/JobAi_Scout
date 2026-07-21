export interface FetchRetryOptions {
  timeoutMs?: number;
  retries?: number;
  retryStatusCodes?: number[];
  backoffMs?: number;
}

const DEFAULT_RETRY_STATUS = [429, 502, 503, 504];

/**
 * fetch() with a hard timeout (AbortSignal) and a bounded retry for
 * transient failures. Upstream AI calls with no timeout can hang a request
 * until the platform's own execution limit — this makes "the API didn't
 * respond" fail fast instead of hanging silently.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 15000,
    retries = 1,
    retryStatusCodes = DEFAULT_RETRY_STATUS,
    backoffMs = 500,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok || !retryStatusCodes.includes(response.status) || attempt === retries) {
        return response;
      }
      lastError = new Error(`Request failed with status ${response.status}`);
    } catch (error) {
      lastError = error instanceof DOMException && error.name === "TimeoutError"
        ? new Error(`Request timed out after ${timeoutMs}ms`)
        : error;
      if (attempt === retries) throw lastError;
    }
    await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
  }
  throw lastError;
}
