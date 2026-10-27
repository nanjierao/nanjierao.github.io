// Fetch GitHub activity and the latest YouTube video during the build (D40, D50) and write them
// to src/generated/ (git-ignored, never committed). Runs before `astro build` (npm `prebuild`).
//
// It never fails the build: every source has a timeout, and on any error that source is left
// empty, so pages fall back quietly (the GitHub section links to the profile; the video card
// hides). Only counts and HTTP status codes are logged.
//
//   EXTERNAL_DATA=network   (default) fetch from GitHub and YouTube
//   EXTERNAL_DATA=keep      keep data an earlier step of the same CI job fetched; fetch if none
//   EXTERNAL_DATA=fixtures  use tests/fixtures/ (screenshots and end-to-end tests)
//   EXTERNAL_DATA=off       write empty data, no network
//   GITHUB_TOKEN            optional; set in GitHub Actions to avoid the shared rate limit
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  EVENTS_URL,
  ORG_REPOS_URL,
  USER_REPOS_URL,
  summarizeEvents,
  summarizeRepos,
} from '../src/lib/github.ts';
import { YOUTUBE_FEED_URL, parseFeed, thumbnailUrl } from '../src/lib/youtube.ts';
import type { ExternalData } from '../src/lib/external-types.ts';
import { FLAGS } from '../src/data/site.ts';
import { isPublishableVideoTitle } from './lib/privacy-rules.ts';
import { filterGitHub } from './lib/filter-external.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'generated');
const FIXTURES = join(ROOT, 'tests', 'fixtures');
const TIMEOUT_MS = 10_000;
const MAX_THUMBNAIL_BYTES = 2_000_000;

type Mode = 'network' | 'keep' | 'fixtures' | 'off';
const requested = (process.env.EXTERNAL_DATA ?? 'network') as Mode;
const DATA_FILE = join(OUT_DIR, 'external.json');
const keep = requested === 'keep' && existsSync(DATA_FILE);
const mode: Exclude<Mode, 'keep'> = requested === 'keep' ? 'network' : requested;

function log(message: string): void {
  console.log(`[fetch-external] ${message}`);
}

async function get(url: string, accept: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': 'nanjierao.github.io-build',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token && url.startsWith('https://api.github.com/')) headers.Authorization = `Bearer ${token}`;
  let response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 401 && headers.Authorization) {
    // A token the API rejects shouldn't cost the data: the endpoints are public.
    delete headers.Authorization;
    response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

async function readFixture(name: string): Promise<string> {
  return readFile(join(FIXTURES, name), 'utf8');
}

function reason(error: unknown): string {
  if (error instanceof Error) return error.name === 'TimeoutError' ? 'timeout' : error.message;
  return 'unknown error';
}

async function loadGitHub(): Promise<ExternalData['github']> {
  try {
    const [events, userRepos, orgRepos] =
      mode === 'fixtures'
        ? await Promise.all(
            ['github-events.json', 'github-user-repos.json', 'github-org-repos.json'].map(
              async (name) => JSON.parse(await readFixture(name)) as unknown,
            ),
          )
        : await Promise.all(
            [EVENTS_URL, USER_REPOS_URL, ORG_REPOS_URL].map(async (url) => {
              const response = await get(url, 'application/vnd.github+json');
              return (await response.json()) as unknown;
            }),
          );
    const filtered = filterGitHub(summarizeEvents(events, 50), summarizeRepos(userRepos, orgRepos));
    const { repos, dropped } = filtered;
    const activity = filtered.activity.slice(0, 5);
    log(`GitHub: ${activity.length} activity items, ${repos.length} repositories`);
    if (dropped > 0)
      log(`GitHub: held back ${dropped} name(s) or description(s) by the §15 filter`);
    return { activity, repos };
  } catch (error) {
    log(`GitHub: not available (${reason(error)}); pages fall back to a profile link`);
    return null;
  }
}

async function loadYouTube(): Promise<ExternalData['youtube']> {
  try {
    const xml =
      mode === 'fixtures'
        ? await readFixture('youtube-feed.xml')
        : await (await get(YOUTUBE_FEED_URL, 'application/atom+xml')).text();
    const videos = parseFeed(xml);
    // D54: titles stay off the site unless Jimmy turns them on; then only titles that pass the
    // §15 rules and the strict family rule, newest first. Without titles, the newest video.
    const latest = FLAGS.showLatestVideoTitle
      ? (videos.find((video) => isPublishableVideoTitle(video.title)) ?? null)
      : (videos[0] ?? null);
    const skipped = latest ? videos.indexOf(latest) : videos.length;
    if (skipped > 0) log(`YouTube: skipped ${skipped} newer video(s) by the title filter`);
    if (!latest) {
      log('YouTube: no publishable video in the feed; the card stays hidden');
      return null;
    }
    // Keep a title out of the build data entirely while titles are off.
    const video = FLAGS.showLatestVideoTitle ? latest : { ...latest, title: '' };
    let thumbnail: string | null = null;
    if (FLAGS.showLatestVideoThumbnail) thumbnail = await saveThumbnail(latest.id);
    log(`YouTube: latest video found${thumbnail ? ' with thumbnail' : ''}`);
    return { latest: video, thumbnail };
  } catch (error) {
    log(`YouTube: feed not available (${reason(error)}); the card stays hidden`);
    return null;
  }
}

/** Download the thumbnail so Astro's image pipeline can process it (no hot-linking). */
async function saveThumbnail(id: string): Promise<string | null> {
  try {
    const bytes =
      mode === 'fixtures'
        ? await readFile(join(FIXTURES, 'youtube-thumbnail.jpg'))
        : Buffer.from(await (await get(thumbnailUrl(id), 'image/jpeg')).arrayBuffer());
    if (bytes.length > MAX_THUMBNAIL_BYTES) throw new Error('thumbnail too large');
    // Re-encode: proves it is an image and drops any metadata before Astro sees it.
    const clean = await sharp(bytes).rotate().jpeg({ quality: 85 }).toBuffer();
    const name = 'latest-video.jpg';
    await writeFile(join(OUT_DIR, name), clean);
    return name;
  } catch (error) {
    log(`YouTube: thumbnail not available (${reason(error)})`);
    return null;
  }
}

async function main(): Promise<void> {
  if (keep) {
    log('EXTERNAL_DATA=keep: using the data fetched earlier in this job');
    return;
  }
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  let data: ExternalData = {
    fetchedAt: new Date().toISOString(),
    source: mode,
    github: null,
    youtube: null,
  };
  if (mode === 'off') {
    log('EXTERNAL_DATA=off: writing empty data');
  } else {
    const [github, youtube] = await Promise.all([loadGitHub(), loadYouTube()]);
    data = { ...data, github, youtube };
  }
  await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error: unknown) => {
  // Last resort: never block the build on optional data.
  log(`unexpected error (${reason(error)}); continuing without external data`);
});
