// Retries for flaky public endpoints (D62). YouTube's feed server answers 404 or 500 for hours
// at a time and then recovers: of the first 11 deploys, 5 got no feed. A failed attempt is
// retried after a pause, and each round also tries the next URL that serves the same data.

/** An HTTP response that wasn't 2xx. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** A response that arrived but can't be used (e.g. a feed with no entries); worth another try. */
export class UnusableResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnusableResponseError';
  }
}

/**
 * Worth another try: timeouts, network errors, unusable responses, and HTTP 404 (YouTube's
 * outage answer), 408, 429 and 5xx.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof UnusableResponseError) return true;
  if (error instanceof HttpError) {
    return (
      error.status === 404 || error.status === 408 || error.status === 429 || error.status >= 500
    );
  }
  if (error instanceof Error) {
    // fetch() rejects with a TypeError on network failures; AbortSignal.timeout with TimeoutError.
    return (
      error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError
    );
  }
  return false;
}

export interface RetryOptions {
  /** Pauses before the second, third, … round, in milliseconds. */
  delays: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Called once per failed attempt that will be followed by another one. */
  onRetry?: (message: string) => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function describe(error: unknown): string {
  if (error instanceof Error) return error.name === 'TimeoutError' ? 'timeout' : error.message;
  return 'unknown error';
}

/**
 * Tries each URL in order; if none works, waits and tries them all again, for up to
 * `delays.length + 1` rounds. Returns the first result `load` returns; `load` throws
 * `UnusableResponseError` for a response it can't use, which counts as a failed attempt.
 * A round in which every error was permanent (e.g. HTTP 403) ends the retries. Throws the last
 * error when nothing worked.
 */
export async function firstSuccess<T>(
  urls: readonly string[],
  load: (url: string) => Promise<T>,
  { delays, sleep = wait, onRetry }: RetryOptions,
): Promise<T> {
  if (urls.length === 0) throw new Error('no URL to try');
  const rounds = delays.length + 1;
  let lastError: unknown = new Error('no attempt made');
  for (let round = 0; round < rounds; round++) {
    if (round > 0) await sleep(delays[round - 1]!);
    let worthRetrying = false;
    for (const [index, url] of urls.entries()) {
      try {
        return await load(url);
      } catch (error) {
        lastError = error;
        if (isRetryable(error)) worthRetrying = true;
        const attempt = round * urls.length + index + 1;
        if (index < urls.length - 1) {
          onRetry?.(`attempt ${attempt} failed (${describe(error)}); trying the next address`);
        } else if (worthRetrying && round < rounds - 1) {
          const seconds = Math.round(delays[round]! / 1000);
          onRetry?.(`attempt ${attempt} failed (${describe(error)}); retrying in ${seconds} s`);
        }
      }
    }
    if (!worthRetrying) break;
  }
  throw lastError;
}
