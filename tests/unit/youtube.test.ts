import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isPublishableVideoTitle } from '../../scripts/lib/privacy-rules.ts';
import {
  YOUTUBE_FEED_URL,
  isVideoId,
  latestVideo,
  parseFeed,
  thumbnailUrl,
  watchUrl,
} from '../../src/lib/youtube.ts';

const feed = readFileSync(new URL('../fixtures/youtube-feed.xml', import.meta.url), 'utf8');

describe('YouTube feed (D50)', () => {
  it('reads the channel ID from facts.md §13', () => {
    expect(YOUTUBE_FEED_URL).toBe(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCsaBHMWGQFx1Mltl3nFQc3g',
    );
  });

  it('parses valid entries newest first and drops invalid IDs', () => {
    const videos = parseFeed(feed);
    expect(videos.map((video) => video.id)).toEqual(['AAAAAAAAAA1', 'AAAAAAAAAA2', 'AAAAAAAAAA3']);
    expect(videos[1]!.title).toBe(
      'Fixture video: testing a common piece of advice & what happened',
    );
    expect(videos[1]!.url).toBe('https://www.youtube.com/watch?v=AAAAAAAAAA2');
  });

  it('returns nothing for a broken or empty feed', () => {
    expect(parseFeed('<html>blocked</html>')).toEqual([]);
    expect(parseFeed('not xml at all <<<')).toEqual([]);
    expect(latestVideo('')).toBeNull();
  });

  it('skips titles in a facts.md §15 category, as the build script does', () => {
    const latest = parseFeed(feed).find((video) => isPublishableVideoTitle(video.title));
    expect(latest?.id).toBe('AAAAAAAAAA2');
  });

  it('builds YouTube URLs only from valid IDs', () => {
    expect(isVideoId('u9nYUBc-_s0')).toBe(true);
    expect(isVideoId('u9nYUBc-_s0"><script>')).toBe(false);
    expect(watchUrl('u9nYUBc-_s0', 74)).toBe('https://www.youtube.com/watch?v=u9nYUBc-_s0&t=74s');
    expect(thumbnailUrl('OX2zRUeDojg')).toBe('https://i.ytimg.com/vi/OX2zRUeDojg/hqdefault.jpg');
  });
});
