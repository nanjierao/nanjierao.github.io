// Latest YouTube video (D50), read from the channel's public RSS (Atom) feed during the build.
// The feed is untrusted input: only a well-formed video ID, a title and a date survive.
import { XMLParser } from 'fast-xml-parser';

export const YOUTUBE_CHANNEL_ID = 'UCsaBHMWGQFx1Mltl3nFQc3g';
export const YOUTUBE_FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
/** The channel's uploads playlist ("UU" + the rest of the channel ID): the same videos. */
export const YOUTUBE_UPLOADS_FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=UU${YOUTUBE_CHANNEL_ID.slice(2)}`;
/** Tried in this order; the second answers when the first doesn't, now and then (D62). */
export const YOUTUBE_FEED_URLS = [YOUTUBE_FEED_URL, YOUTUBE_UPLOADS_FEED_URL] as const;

export interface VideoItem {
  id: string;
  title: string;
  /** ISO timestamp */
  published: string;
  url: string;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID.test(value);
}

export function watchUrl(id: string, startSeconds?: number): string {
  const start = startSeconds ? `&t=${startSeconds}s` : '';
  return `https://www.youtube.com/watch?v=${id}${start}`;
}

/** Thumbnail address used only by the build script to download and process the image. */
export function thumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

/** All valid videos in the feed, newest first. */
export function parseFeed(xml: string): VideoItem[] {
  const parser = new XMLParser({
    ignoreAttributes: true,
    processEntities: true,
    htmlEntities: true,
    isArray: (name) => name === 'entry',
  });
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const feed = (doc as { feed?: { entry?: unknown[] } } | null)?.feed;
  const entries = Array.isArray(feed?.entry) ? feed.entry : [];
  const videos: VideoItem[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const id = text(e['yt:videoId']);
    const title = text(e.title);
    const published = text(e.published);
    if (!isVideoId(id) || !title || !published || Number.isNaN(Date.parse(published))) continue;
    videos.push({ id, title: title.slice(0, 200), published, url: watchUrl(id) });
  }
  return videos.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
}

/**
 * True when the text is this channel's Atom feed, even one with no entries: a real answer, as
 * opposed to an error page served with status 200 (D62).
 */
export function isChannelFeed(xml: string): boolean {
  const parser = new XMLParser({ ignoreAttributes: true });
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return false;
  }
  const feed = (doc as { feed?: unknown } | null)?.feed;
  if (typeof feed !== 'object' || feed === null) return false;
  const channel = (feed as Record<string, unknown>)['yt:channelId'];
  return channel === undefined || channel === YOUTUBE_CHANNEL_ID;
}

export function latestVideo(xml: string): VideoItem | null {
  return parseFeed(xml)[0] ?? null;
}
