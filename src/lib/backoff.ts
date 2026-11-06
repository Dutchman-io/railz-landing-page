// Exponential backoff with jitter — PRD §6 "Network Resilience & Backoff".
// Used by the API client to retry idempotent operations during cellular flakiness.

export interface BackoffOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  // Caller decides if a thrown error is worth retrying (e.g. network errors yes, 4xx no).
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULTS: Required<Omit<BackoffOptions, 'shouldRetry'>> & Pick<BackoffOptions, 'shouldRetry'> = {
  maxRetries: 3,
  baseDelayMs: 300,
  maxDelayMs: 5_000,
  shouldRetry: undefined,
};

export async function withBackoff<T>(
  op: () => Promise<T>,
  options: BackoffOptions = {},
): Promise<T> {
  const opts = { ...DEFAULTS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastError = err;
      const canRetry = attempt < opts.maxRetries && (opts.shouldRetry?.(err, attempt) ?? true);
      if (!canRetry) break;
      const exp = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** attempt);
      const jitter = Math.random() * exp;
      await sleep(jitter);
    }
  }
  throw lastError;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Most API errors are objects with a `status` field (set by api.ts).
// Network errors are TypeError 'Network request failed' in React Native fetch.
//
// A request abandoned by api.ts's timeout carries `timedOut: true`. It is worth
// one more go (a GET on a flaky connection often lands the second time), but
// not three: each attempt already waited the full timeout, and the person is
// looking at a spinner. POSTs never get here -- they do not retry by default.
export const isRetriableNetworkError = (err: unknown, attempt = 0): boolean => {
  if (err instanceof TypeError) return true;
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as { timedOut?: unknown }).timedOut === true
  ) {
    return attempt === 0;
  }
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === 'number') {
      // Retry server errors and 429 throttling; not 4xx client errors.
      return status >= 500 || status === 429;
    }
  }
  return false;
};
