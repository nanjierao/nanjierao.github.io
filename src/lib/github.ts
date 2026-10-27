// GitHub activity and repositories (D40). Activity and repositories come from Jimmy's personal
// account plus the public repositories of the `nanjierao` organization; never from whoever
// owns this repository. Everything here treats the API response as untrusted input: unknown
// shapes are dropped, and the output is plain text that pages render escaped.

export const GITHUB_USER = 'JimmyRaoUF';
export const GITHUB_ORG = 'nanjierao';
export const GITHUB_API = 'https://api.github.com';

export const EVENTS_URL = `${GITHUB_API}/users/${GITHUB_USER}/events/public?per_page=50`;
export const USER_REPOS_URL = `${GITHUB_API}/users/${GITHUB_USER}/repos?type=owner&sort=pushed&per_page=100`;
export const ORG_REPOS_URL = `${GITHUB_API}/orgs/${GITHUB_ORG}/repos?type=public&sort=pushed&per_page=100`;

export interface ActivityItem {
  /** What happened, in plain words, without the repository name. */
  action: string;
  /** owner/name */
  repo: string;
  repoUrl: string;
  /** ISO timestamp */
  date: string;
}

export interface RepoItem {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  pushedAt: string;
  archived: boolean;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const REPO_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/** Describe one public event, or return null for event types we don't show. */
export function describeEvent(event: unknown): ActivityItem | null {
  if (!isObject(event) || !isObject(event.repo) || !isObject(event.payload ?? {})) return null;
  const type = str(event.type);
  const repo = str(event.repo.name);
  const date = str(event.created_at);
  if (!type || !repo || !REPO_NAME.test(repo) || !date || !isValidDate(date)) return null;
  const payload = (event.payload ?? {}) as Json;

  let action: string | null = null;
  switch (type) {
    case 'PushEvent':
      action = 'Pushed commits to';
      break;
    case 'CreateEvent':
      if (payload.ref_type === 'repository') action = 'Created the repository';
      break;
    case 'PublicEvent':
      action = 'Made public:';
      break;
    case 'ReleaseEvent':
      if (payload.action === 'published') action = 'Published a release of';
      break;
    case 'ForkEvent':
      action = 'Forked';
      break;
    case 'PullRequestEvent': {
      const pr = isObject(payload.pull_request) ? payload.pull_request : {};
      if (payload.action === 'opened') action = 'Opened a pull request in';
      else if (payload.action === 'closed' && pr.merged === true) {
        action = 'Merged a pull request in';
      }
      break;
    }
    case 'IssuesEvent':
      if (payload.action === 'opened') action = 'Opened an issue in';
      break;
    default:
      // Stars, comments, reviews and the like are left out: they are noise in a short list.
      action = null;
  }
  if (!action) return null;
  return { action, repo, repoUrl: `https://github.com/${repo}`, date };
}

/**
 * Turn the events API response into a short activity list: newest first, consecutive events
 * of the same kind in the same repository folded into one line.
 */
export function summarizeEvents(events: unknown, limit = 5): ActivityItem[] {
  if (!Array.isArray(events)) return [];
  const items = events
    .map(describeEvent)
    .filter((item): item is ActivityItem => item !== null)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const folded: ActivityItem[] = [];
  for (const item of items) {
    const previous = folded.at(-1);
    if (previous && previous.repo === item.repo && previous.action === item.action) continue;
    folded.push(item);
    if (folded.length === limit) break;
  }
  return folded;
}

/**
 * Re-validate activity items that come back from storage (sessionStorage or the build's JSON):
 * keep only well-formed ones and rebuild each link from the repository name.
 */
export function sanitizeActivity(items: unknown): ActivityItem[] {
  if (!Array.isArray(items)) return [];
  const clean: ActivityItem[] = [];
  for (const item of items) {
    if (!isObject(item)) continue;
    const action = str(item.action);
    const repo = str(item.repo);
    const date = str(item.date);
    if (!action || action.length > 60 || !repo || !REPO_NAME.test(repo)) continue;
    if (!date || !isValidDate(date)) continue;
    clean.push({ action, repo, repoUrl: `https://github.com/${repo}`, date });
  }
  return clean;
}

function toRepo(value: unknown): RepoItem | null {
  if (!isObject(value)) return null;
  if (value.private === true || value.fork === true) return null;
  const name = str(value.name);
  const fullName = str(value.full_name);
  const pushedAt = str(value.pushed_at);
  if (!name || !fullName || !REPO_NAME.test(fullName) || !pushedAt || !isValidDate(pushedAt)) {
    return null;
  }
  return {
    name,
    fullName,
    url: `https://github.com/${fullName}`,
    description: str(value.description),
    language: str(value.language),
    stars: typeof value.stargazers_count === 'number' ? value.stargazers_count : 0,
    pushedAt,
    archived: value.archived === true,
  };
}

/** Merge user and organization repositories: public, not forks, most recently pushed first. */
export function summarizeRepos(...lists: unknown[]): RepoItem[] {
  const seen = new Set<string>();
  const repos: RepoItem[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const value of list) {
      const repo = toRepo(value);
      if (!repo || seen.has(repo.fullName.toLowerCase())) continue;
      seen.add(repo.fullName.toLowerCase());
      repos.push(repo);
    }
  }
  return repos.sort((a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt));
}
