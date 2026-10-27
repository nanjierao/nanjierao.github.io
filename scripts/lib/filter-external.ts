// Filters for text fetched at build time (scripts/fetch-external.ts).
import type { ActivityItem, RepoItem } from '../../src/lib/github.ts';
import { isPublishableFetchedText } from './privacy-rules.ts';

/**
 * Fetched text must pass the same rules as the build-output privacy scan, so a repository name
 * or description can never fail a deploy, and must not name family (D54). Items whose name fails
 * are dropped; a failing description is removed and the repository kept.
 */
export function filterGitHub(
  activity: ActivityItem[],
  repos: RepoItem[],
): { activity: ActivityItem[]; repos: RepoItem[]; dropped: number } {
  let dropped = 0;
  const keptActivity = activity.filter((item) => {
    const ok = isPublishableFetchedText(item.repo);
    if (!ok) dropped++;
    return ok;
  });
  const keptRepos: RepoItem[] = [];
  for (const repo of repos) {
    if (!isPublishableFetchedText(repo.fullName)) {
      dropped++;
      continue;
    }
    if (repo.description && !isPublishableFetchedText(repo.description)) {
      dropped++;
      keptRepos.push({ ...repo, description: null });
    } else {
      keptRepos.push(repo);
    }
  }
  return { activity: keptActivity, repos: keptRepos, dropped };
}
