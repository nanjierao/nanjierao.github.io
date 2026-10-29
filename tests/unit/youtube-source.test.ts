// The latest-video loader (D62): feed fallbacks, retries, and the last result that worked.
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { HttpError } from '../../scripts/lib/fetch-retry.ts';
import { isPublishableVideoTitle } from '../../scripts/lib/privacy-rules.ts';
import {
  LAST_GOOD_FILE,
  THUMBNAIL_FILE,
  loadLatestVideo,
  parseLastGood,
  type LastGoodVideo,
  type YouTubeDeps,
} from '../../scripts/lib/youtube-source.ts';
import { YOUTUBE_FEED_URL, YOUTUBE_FEED_URLS } from '../../src/lib/youtube.ts';

const FEED = readFileSync(new URL('../fixtures/youtube-feed.xml', import.meta.url), 'utf8');
const THUMBNAIL = readFileSync(new URL('../fixtures/youtube-thumbnail.jpg', import.meta.url));
const NOW = new Date('2026-10-29T15:17:00Z');

let outDir: string;
let cacheDir: string;
let log: string[];
let feedCalls: string[];

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'youtube-source-'));
  outDir = join(root, 'generated');
  cacheDir = join(root, 'cache');
  mkdirSync(outDir);
  log = [];
  feedCalls = [];
});

function deps(overrides: Partial<YouTubeDeps> = {}): YouTubeDeps {
  return {
    fetchText: async (url) => {
      feedCalls.push(url);
      return FEED;
    },
    fetchBytes: async () => THUMBNAIL,
    cleanThumbnail: async (bytes) => bytes,
    isPublishableTitle: isPublishableVideoTitle,
    flags: { showTitle: true, showThumbnail: true },
    outDir,
    cacheDir,
    now: NOW,
    delays: [15_000, 45_000],
    sleep: async () => {},
    log: (message) => log.push(message),
    ...overrides,
  };
}

const failingFeed =
  (status = 404) =>
  async (url: string) => {
    feedCalls.push(url);
    throw new HttpError(status);
  };

function remembered(record: Partial<LastGoodVideo> & { savedAt: string }): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    join(cacheDir, LAST_GOOD_FILE),
    JSON.stringify({
      latest: {
        id: 'BBBBBBBBBB1',
        title: 'Remembered video: a parenting tip, tested',
        published: '2026-10-20T14:00:00+00:00',
        url: 'https://example.com/not-trusted',
      },
      thumbnail: THUMBNAIL_FILE,
      ...record,
    }),
  );
  writeFileSync(join(cacheDir, THUMBNAIL_FILE), THUMBNAIL);
}

describe('feed addresses (D62)', () => {
  it('tries the channel feed first, then the uploads playlist of the same channel', () => {
    expect(YOUTUBE_FEED_URLS[0]).toBe(YOUTUBE_FEED_URL);
    expect(YOUTUBE_FEED_URLS[1]).toBe(
      'https://www.youtube.com/feeds/videos.xml?playlist_id=UUsaBHMWGQFx1Mltl3nFQc3g',
    );
  });
});

describe('loadLatestVideo when the feed works', () => {
  it('shows the newest video whose title passes, with its thumbnail, and remembers it', async () => {
    const result = await loadLatestVideo(deps());
    expect(result?.latest.id).toBe('AAAAAAAAAA2');
    expect(result?.thumbnail).toBe(THUMBNAIL_FILE);
    expect(existsSync(join(outDir, THUMBNAIL_FILE))).toBe(true);
    expect(feedCalls).toEqual([YOUTUBE_FEED_URLS[0]]);
    const record = JSON.parse(readFileSync(join(cacheDir, LAST_GOOD_FILE), 'utf8'));
    expect(record.savedAt).toBe(NOW.toISOString());
    expect(record.latest.id).toBe('AAAAAAAAAA2');
    expect(record.thumbnail).toBe(THUMBNAIL_FILE);
    expect(existsSync(join(cacheDir, THUMBNAIL_FILE))).toBe(true);
    expect(log).toContain('YouTube: skipped 1 newer video(s) by the title filter');
    expect(log).toContain('YouTube: latest video found with thumbnail');
  });

  it('uses the uploads-playlist feed when the channel feed fails', async () => {
    const result = await loadLatestVideo(
      deps({
        fetchText: async (url) => {
          feedCalls.push(url);
          if (url === YOUTUBE_FEED_URLS[0]) throw new HttpError(404);
          return FEED;
        },
      }),
    );
    expect(result?.latest.id).toBe('AAAAAAAAAA2');
    expect(feedCalls).toEqual([...YOUTUBE_FEED_URLS]);
  });

  it('keeps the video when only the thumbnail fails, and remembers it without one', async () => {
    const result = await loadLatestVideo(
      deps({
        fetchBytes: async () => {
          throw new HttpError(404);
        },
      }),
    );
    expect(result).toMatchObject({ latest: { id: 'AAAAAAAAAA2' }, thumbnail: null });
    const record = JSON.parse(readFileSync(join(cacheDir, LAST_GOOD_FILE), 'utf8'));
    expect(record.thumbnail).toBeNull();
  });

  it('hides the card and forgets the older result when no title in the feed passes', async () => {
    remembered({ savedAt: '2026-10-25T00:00:00Z' });
    const result = await loadLatestVideo(deps({ isPublishableTitle: () => false }));
    expect(result).toBeNull();
    expect(existsSync(join(cacheDir, LAST_GOOD_FILE))).toBe(false);
  });

  it('keeps titles out of the build data and the cache while titles are off', async () => {
    const result = await loadLatestVideo(
      deps({ flags: { showTitle: false, showThumbnail: false } }),
    );
    // Titles off: the newest video, whatever its title, and no title anywhere.
    expect(result).toMatchObject({ latest: { id: 'AAAAAAAAAA1', title: '' }, thumbnail: null });
    const record = JSON.parse(readFileSync(join(cacheDir, LAST_GOOD_FILE), 'utf8'));
    expect(record.latest.title).toBe('');
  });

  it('writes nothing to the cache when there is no cache folder (fixture builds)', async () => {
    const result = await loadLatestVideo(deps({ cacheDir: null }));
    expect(result?.latest.id).toBe('AAAAAAAAAA2');
    expect(existsSync(cacheDir)).toBe(false);
  });
});

describe('loadLatestVideo when the feed fails', () => {
  it('retries both addresses for three rounds, then shows the last result that worked', async () => {
    remembered({ savedAt: '2026-10-28T14:12:00Z' });
    const result = await loadLatestVideo(deps({ fetchText: failingFeed(404) }));
    expect(feedCalls).toHaveLength(6);
    expect(result).toMatchObject({
      latest: {
        id: 'BBBBBBBBBB1',
        title: 'Remembered video: a parenting tip, tested',
        // Rebuilt from the ID, never taken from the cache.
        url: 'https://www.youtube.com/watch?v=BBBBBBBBBB1',
      },
      thumbnail: THUMBNAIL_FILE,
    });
    expect(existsSync(join(outDir, THUMBNAIL_FILE))).toBe(true);
    expect(log).toContain('YouTube: feed not available (HTTP 404)');
    expect(log).toContain(
      'YouTube: showing the latest video from the last feed that worked (2026-10-28)',
    );
  });

  it('falls back the same way when the feed answers with something that has no videos', async () => {
    remembered({ savedAt: '2026-10-28T14:12:00Z' });
    const result = await loadLatestVideo(deps({ fetchText: async () => '<html>Sorry</html>' }));
    expect(result?.latest.id).toBe('BBBBBBBBBB1');
  });

  it('hides the card without an earlier result', async () => {
    expect(await loadLatestVideo(deps({ fetchText: failingFeed(500) }))).toBeNull();
    expect(log).toContain('YouTube: no earlier result to fall back on; the card stays hidden');
  });

  it('hides the card when the earlier result is more than 30 days old', async () => {
    remembered({ savedAt: '2026-09-28T00:00:00Z' });
    expect(await loadLatestVideo(deps({ fetchText: failingFeed() }))).toBeNull();
  });

  it("hides the card when the earlier result's title no longer passes the filters", async () => {
    remembered({
      savedAt: '2026-10-28T14:12:00Z',
      latest: {
        id: 'BBBBBBBBBB1',
        title: 'Fixture: my daughter and the bedtime rule',
        published: '2026-10-20T14:00:00+00:00',
        url: '',
      },
    });
    expect(await loadLatestVideo(deps({ fetchText: failingFeed() }))).toBeNull();
  });

  it('shows the earlier result without a thumbnail when the thumbnail file is gone', async () => {
    remembered({ savedAt: '2026-10-28T14:12:00Z' });
    writeFileSync(join(cacheDir, THUMBNAIL_FILE), '');
    const result = await loadLatestVideo(
      deps({
        fetchText: failingFeed(),
        cleanThumbnail: async () => {
          throw new Error('not an image');
        },
      }),
    );
    expect(result).toMatchObject({ latest: { id: 'BBBBBBBBBB1' }, thumbnail: null });
  });

  it('ignores a corrupt cache file', async () => {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, LAST_GOOD_FILE), '{ not json');
    expect(await loadLatestVideo(deps({ fetchText: failingFeed() }))).toBeNull();
  });
});

describe('parseLastGood', () => {
  const good = {
    savedAt: '2026-10-28T14:12:00.000Z',
    latest: { id: 'BBBBBBBBBB1', title: 'A title', published: '2026-10-20T14:00:00Z' },
    thumbnail: THUMBNAIL_FILE,
  };

  it('accepts a recent, well-formed record and rebuilds the watch URL', () => {
    expect(parseLastGood(good, NOW)).toEqual({
      ...good,
      latest: { ...good.latest, url: 'https://www.youtube.com/watch?v=BBBBBBBBBB1' },
    });
  });

  it('rejects bad IDs, bad dates, future or stale records, and odd shapes', () => {
    expect(parseLastGood({ ...good, latest: { ...good.latest, id: '../../etc' } }, NOW)).toBeNull();
    expect(
      parseLastGood({ ...good, latest: { ...good.latest, published: 'soon' } }, NOW),
    ).toBeNull();
    expect(parseLastGood({ ...good, latest: { ...good.latest, title: 7 } }, NOW)).toBeNull();
    expect(parseLastGood({ ...good, savedAt: '2026-11-05T00:00:00Z' }, NOW)).toBeNull();
    expect(parseLastGood({ ...good, savedAt: '2026-09-01T00:00:00Z' }, NOW)).toBeNull();
    expect(parseLastGood({ ...good, latest: null }, NOW)).toBeNull();
    expect(parseLastGood(null, NOW)).toBeNull();
    expect(parseLastGood('text', NOW)).toBeNull();
  });

  it('only trusts the one thumbnail file name it writes', () => {
    expect(parseLastGood({ ...good, thumbnail: '../../secret.jpg' }, NOW)?.thumbnail).toBeNull();
  });
});
