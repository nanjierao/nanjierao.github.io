import type { ActivityItem, RepoItem } from './github.ts';
import type { VideoItem } from './youtube.ts';

/** Shape of src/generated/external.json, written by scripts/fetch-external.ts. */
export interface ExternalData {
  fetchedAt: string;
  source: 'network' | 'fixtures' | 'off';
  github: { activity: ActivityItem[]; repos: RepoItem[] } | null;
  youtube: { latest: VideoItem; thumbnail: string | null } | null;
}
