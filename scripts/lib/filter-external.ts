// Filters for text fetched at build time (scripts/fetch-external.ts).
import type { ActivityItem, RepoItem } from '../../src/lib/github.ts';
import { isPublishableText } from './privacy-rules.ts';

/**
 * Fetched repository names and descriptions must pass the same rules as the build-output privacy
 * scan, so they can never fail a deploy. Items whose name fails are dropped; a failing description
 * is removed and the repository kept.
 */
export function filterGitHub(
  activity: ActivityItem[],
  repos: RepoItem[],
): { activity: ActivityItem[]; repos: RepoItem[]; dropped: number } {
  let dropped = 0;
  const keptActivity = activity.filter((item) => {
    const ok = isPublishableText(item.repo);
    if (!ok) dropped++;
    return ok;
  });
  const keptRepos: RepoItem[] = [];
  for (const repo of repos) {
    if (!isPublishableText(repo.fullName)) {
      dropped++;
      continue;
    }
    if (repo.description && !isPublishableText(repo.description)) {
      dropped++;
      keptRepos.push({ ...repo, description: null });
    } else {
      keptRepos.push(repo);
    }
  }
  return { activity: keptActivity, repos: keptRepos, dropped };
}
