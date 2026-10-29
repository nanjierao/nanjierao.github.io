// The latest YouTube video for the homepage card (D50, D54, D62), with its fallbacks: two feed
// addresses, retries with pauses, and the last result that worked. The build script keeps that
// last result in .cache/external/, which GitHub Actions carries between runs (actions/cache), so
// a feed outage at build time shows the last known video instead of hiding the card.
// Everything that touches the network or the disk comes in through `deps`, so tests can run it.
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExternalData } from '../../src/lib/external-types.ts';
import {
  YOUTUBE_FEED_URLS,
  isVideoId,
  parseFeed,
  thumbnailUrl,
  watchUrl,
  type VideoItem,
} from '../../src/lib/youtube.ts';
import { UnusableResponseError, firstSuccess } from './fetch-retry.ts';

export const LAST_GOOD_FILE = 'youtube.json';
export const THUMBNAIL_FILE = 'latest-video.jpg';
/** A remembered video older than this is no longer shown as the latest. */
export const LAST_GOOD_MAX_AGE_DAYS = 30;
const MAX_THUMBNAIL_BYTES = 2_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LastGoodVideo {
  /** When the feed last worked (ISO timestamp). */
  savedAt: string;
  latest: VideoItem;
  /** THUMBNAIL_FILE when a thumbnail was kept beside the record, else null. */
  thumbnail: string | null;
}

export interface YouTubeDeps {
  /** Fetches a feed; throws `HttpError` (or a network error) when it fails. */
  fetchText: (url: string) => Promise<string>;
  fetchBytes: (url: string) => Promise<Buffer>;
  /** Re-encodes a thumbnail: proves it is an image and drops any metadata. */
  cleanThumbnail: (bytes: Buffer) => Promise<Buffer>;
  /** facts.md §15 rules plus the strict family rule (D54). */
  isPublishableTitle: (title: string) => boolean;
  flags: { showTitle: boolean; showThumbnail: boolean };
  /** src/generated/: where the build reads the thumbnail from. */
  outDir: string;
  /** Where the last good result is kept between builds; null keeps nothing (fixtures, tests). */
  cacheDir: string | null;
  now: Date;
  /** Pauses between rounds of attempts (see firstSuccess). */
  delays: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  log: (message: string) => void;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.name === 'TimeoutError' ? 'timeout' : error.message;
  return 'unknown error';
}

/**
 * Validates a remembered result. The cache is written only by this repository's own builds on
 * main, but it is read as untrusted input all the same: a well-formed video ID, a title and a
 * date survive, and the watch URL is rebuilt from the ID.
 */
export function parseLastGood(
  raw: unknown,
  now: Date,
  maxAgeDays = LAST_GOOD_MAX_AGE_DAYS,
): LastGoodVideo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const savedAt = typeof record.savedAt === 'string' ? Date.parse(record.savedAt) : Number.NaN;
  if (Number.isNaN(savedAt)) return null;
  const age = now.getTime() - savedAt;
  // A record from the future (clock skew beyond a day) or older than the limit doesn't count.
  if (age < -DAY_MS || age > maxAgeDays * DAY_MS) return null;
  const latest = record.latest as Record<string, unknown> | null | undefined;
  if (typeof latest !== 'object' || latest === null) return null;
  const { id, title, published } = latest;
  if (!isVideoId(id) || typeof title !== 'string' || title.length > 200) return null;
  if (typeof published !== 'string' || Number.isNaN(Date.parse(published))) return null;
  const thumbnail = record.thumbnail === THUMBNAIL_FILE ? THUMBNAIL_FILE : null;
  return {
    savedAt: new Date(savedAt).toISOString(),
    latest: { id, title, published, url: watchUrl(id) },
    thumbnail,
  };
}

/** Newest video whose title may be shown (D54), or the newest video while titles are off. */
function choose(videos: VideoItem[], deps: YouTubeDeps): VideoItem | null {
  if (!deps.flags.showTitle) return videos[0] ?? null;
  return videos.find((video) => deps.isPublishableTitle(video.title)) ?? null;
}

/** While titles are off, keep the title out of the build data and the cache entirely. */
function forBuild(video: VideoItem, deps: YouTubeDeps): VideoItem {
  return deps.flags.showTitle ? video : { ...video, title: '' };
}

async function writeThumbnail(bytes: Buffer, deps: YouTubeDeps): Promise<string> {
  if (bytes.length > MAX_THUMBNAIL_BYTES) throw new Error('thumbnail too large');
  await writeFile(join(deps.outDir, THUMBNAIL_FILE), await deps.cleanThumbnail(bytes));
  return THUMBNAIL_FILE;
}

/** Downloads the thumbnail so Astro's image pipeline can process it (no hot-linking). */
async function saveThumbnail(id: string, deps: YouTubeDeps): Promise<string | null> {
  try {
    const bytes = await firstSuccess([thumbnailUrl(id)], deps.fetchBytes, {
      delays: deps.delays.slice(0, 1),
      sleep: deps.sleep,
      onRetry: (message) => deps.log(`YouTube thumbnail: ${message}`),
    });
    return await writeThumbnail(bytes, deps);
  } catch (error) {
    deps.log(`YouTube: thumbnail not available (${describe(error)})`);
    return null;
  }
}

/** Keeps this result for the next build, in case the feed fails then. */
async function remember(video: VideoItem, thumbnail: string | null, deps: YouTubeDeps) {
  if (!deps.cacheDir) return;
  try {
    await mkdir(deps.cacheDir, { recursive: true });
    if (thumbnail) {
      const bytes = await readFile(join(deps.outDir, thumbnail));
      await writeFile(join(deps.cacheDir, THUMBNAIL_FILE), bytes);
    }
    const record: LastGoodVideo = {
      savedAt: deps.now.toISOString(),
      latest: video,
      thumbnail: thumbnail ? THUMBNAIL_FILE : null,
    };
    await writeFile(join(deps.cacheDir, LAST_GOOD_FILE), `${JSON.stringify(record, null, 2)}\n`);
  } catch (error) {
    deps.log(`YouTube: couldn't keep this result for the next build (${describe(error)})`);
  }
}

/** The last result that worked, if it is recent and still passes today's filters. */
async function fromLastGood(deps: YouTubeDeps): Promise<ExternalData['youtube']> {
  const file = deps.cacheDir ? join(deps.cacheDir, LAST_GOOD_FILE) : null;
  if (!file || !existsSync(file)) {
    deps.log('YouTube: no earlier result to fall back on; the card stays hidden');
    return null;
  }
  let record: LastGoodVideo | null;
  try {
    record = parseLastGood(JSON.parse(await readFile(file, 'utf8')), deps.now);
  } catch {
    record = null;
  }
  if (!record) {
    deps.log(
      'YouTube: the earlier result is missing, unreadable or too old; the card stays hidden',
    );
    return null;
  }
  const { latest } = record;
  if (deps.flags.showTitle && (!latest.title || !deps.isPublishableTitle(latest.title))) {
    deps.log("YouTube: the earlier result's title doesn't pass the filters; the card stays hidden");
    return null;
  }
  let thumbnail: string | null = null;
  if (deps.flags.showThumbnail && record.thumbnail && deps.cacheDir) {
    try {
      thumbnail = await writeThumbnail(await readFile(join(deps.cacheDir, record.thumbnail)), deps);
    } catch (error) {
      deps.log(`YouTube: the earlier thumbnail isn't usable (${describe(error)})`);
    }
  }
  deps.log(
    `YouTube: showing the latest video from the last feed that worked (${record.savedAt.slice(0, 10)})`,
  );
  return { latest: forBuild(latest, deps), thumbnail };
}

/** The video for the homepage card, or null to hide the card. Never throws. */
export async function loadLatestVideo(deps: YouTubeDeps): Promise<ExternalData['youtube']> {
  let videos: VideoItem[];
  try {
    videos = await firstSuccess(
      YOUTUBE_FEED_URLS,
      async (url) => {
        const found = parseFeed(await deps.fetchText(url));
        if (found.length === 0) throw new UnusableResponseError('no videos in the feed');
        return found;
      },
      {
        delays: deps.delays,
        sleep: deps.sleep,
        onRetry: (message) => deps.log(`YouTube: ${message}`),
      },
    );
  } catch (error) {
    deps.log(`YouTube: feed not available (${describe(error)})`);
    return fromLastGood(deps);
  }
  try {
    const latest = choose(videos, deps);
    const skipped = latest ? videos.indexOf(latest) : videos.length;
    if (skipped > 0) deps.log(`YouTube: skipped ${skipped} newer video(s) by the title filter`);
    if (!latest) {
      // The feed worked, so this is the answer: forget any older result rather than fall back
      // to it during a later outage.
      deps.log('YouTube: no publishable video in the feed; the card stays hidden');
      if (deps.cacheDir) await rm(join(deps.cacheDir, LAST_GOOD_FILE), { force: true });
      return null;
    }
    const video = forBuild(latest, deps);
    const thumbnail = deps.flags.showThumbnail ? await saveThumbnail(latest.id, deps) : null;
    deps.log(`YouTube: latest video found${thumbnail ? ' with thumbnail' : ''}`);
    await remember(video, thumbnail, deps);
    return { latest: video, thumbnail };
  } catch (error) {
    deps.log(`YouTube: unexpected error (${describe(error)}); the card stays hidden`);
    return null;
  }
}
