import { describe, expect, it } from 'vitest';
import {
  HttpError,
  UnusableResponseError,
  firstSuccess,
  isRetryable,
} from '../../scripts/lib/fetch-retry.ts';

const noSleep = { sleeps: [] as number[] };
function options(delays: number[], log: string[] = []) {
  noSleep.sleeps = [];
  return {
    delays,
    sleep: async (ms: number) => {
      noSleep.sleeps.push(ms);
    },
    onRetry: (message: string) => log.push(message),
  };
}

describe('isRetryable (D62)', () => {
  it('retries outages, rate limits, timeouts and network errors', () => {
    for (const status of [404, 408, 429, 500, 502, 503])
      expect(isRetryable(new HttpError(status))).toBe(true);
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    expect(isRetryable(timeout)).toBe(true);
    expect(isRetryable(new TypeError('fetch failed'))).toBe(true);
    expect(isRetryable(new UnusableResponseError('no videos in the feed'))).toBe(true);
  });

  it('gives up on permanent errors', () => {
    for (const status of [400, 401, 403, 410])
      expect(isRetryable(new HttpError(status))).toBe(false);
    expect(isRetryable(new Error('thumbnail too large'))).toBe(false);
    expect(isRetryable('a string')).toBe(false);
  });
});

describe('firstSuccess (D62)', () => {
  it('returns the first address that works and tries the next one right away', async () => {
    const calls: string[] = [];
    const log: string[] = [];
    const result = await firstSuccess(
      ['a', 'b'],
      async (url) => {
        calls.push(url);
        if (url === 'a') throw new HttpError(404);
        return `ok from ${url}`;
      },
      options([15_000, 45_000], log),
    );
    expect(result).toBe('ok from b');
    expect(calls).toEqual(['a', 'b']);
    expect(noSleep.sleeps).toEqual([]);
    expect(log).toEqual(['attempt 1 failed (HTTP 404); trying the next address']);
  });

  it('waits between rounds and succeeds on a later round', async () => {
    let attempts = 0;
    const log: string[] = [];
    const result = await firstSuccess(
      ['a', 'b'],
      async () => {
        attempts += 1;
        if (attempts < 5) throw new HttpError(500);
        return 'ok';
      },
      options([15_000, 45_000], log),
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(5);
    expect(noSleep.sleeps).toEqual([15_000, 45_000]);
    expect(log).toContain('attempt 2 failed (HTTP 500); retrying in 15 s');
    expect(log).toContain('attempt 4 failed (HTTP 500); retrying in 45 s');
  });

  it('throws the last error after every round fails, without a retry message at the end', async () => {
    const log: string[] = [];
    let attempts = 0;
    await expect(
      firstSuccess(
        ['a', 'b'],
        async () => {
          attempts += 1;
          throw new HttpError(attempts === 6 ? 503 : 404);
        },
        options([1, 2], log),
      ),
    ).rejects.toThrow('HTTP 503');
    expect(attempts).toBe(6);
    expect(log.some((line) => line.startsWith('attempt 6'))).toBe(false);
  });

  it('stops after a round of permanent errors, but still tries every address in it', async () => {
    const calls: string[] = [];
    await expect(
      firstSuccess(
        ['a', 'b'],
        async (url) => {
          calls.push(url);
          throw new HttpError(403);
        },
        options([15_000]),
      ),
    ).rejects.toThrow('HTTP 403');
    expect(calls).toEqual(['a', 'b']);
    expect(noSleep.sleeps).toEqual([]);
  });

  it('treats an unusable response as a failed attempt', async () => {
    let attempts = 0;
    const result = await firstSuccess(
      ['feed'],
      async () => {
        attempts += 1;
        if (attempts === 1) throw new UnusableResponseError('no videos in the feed');
        return ['video'];
      },
      options([10]),
    );
    expect(result).toEqual(['video']);
    expect(noSleep.sleeps).toEqual([10]);
  });

  it('needs at least one address', async () => {
    await expect(firstSuccess([], async () => 'x', options([]))).rejects.toThrow('no URL');
  });
});
