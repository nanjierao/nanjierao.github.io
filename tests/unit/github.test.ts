import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EVENTS_URL,
  ORG_REPOS_URL,
  USER_REPOS_URL,
  describeEvent,
  sanitizeActivity,
  summarizeEvents,
  summarizeRepos,
} from '../../src/lib/github.ts';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

describe('sources (D40)', () => {
  it("reads Jimmy's personal account and the nanjierao organization, not the repo owner alone", () => {
    expect(EVENTS_URL).toContain('/users/JimmyRaoUF/events/public');
    expect(USER_REPOS_URL).toContain('/users/JimmyRaoUF/repos');
    expect(ORG_REPOS_URL).toContain('/orgs/nanjierao/repos');
  });
});

describe('summarizeEvents', () => {
  const activity = summarizeEvents(fixture('github-events.json'));

  it('keeps the event kinds worth showing, newest first, and folds repeats', () => {
    expect(activity.map((item) => [item.action, item.repo])).toEqual([
      ['Pushed commits to', 'JimmyRaoUF/fixture-study-tools'],
      ['Merged a pull request in', 'nanjierao/nanjierao.github.io'],
      ['Created the repository', 'nanjierao/nanjierao.github.io'],
      ['Published a release of', 'JimmyRaoUF/fixture-coding-scheme'],
    ]);
  });

  it('drops malformed events, including markup posing as a repository name', () => {
    expect(activity.some((item) => item.repo.includes('<'))).toBe(false);
    expect(activity.some((item) => item.repo === 'JimmyRaoUF/broken')).toBe(false);
    expect(describeEvent(null)).toBeNull();
    expect(describeEvent({ type: 'PushEvent' })).toBeNull();
  });

  it('builds links from the repository name', () => {
    expect(activity[0]!.repoUrl).toBe('https://github.com/JimmyRaoUF/fixture-study-tools');
  });

  it('returns nothing for a non-array response (rate-limit errors are objects)', () => {
    expect(summarizeEvents({ message: 'API rate limit exceeded' })).toEqual([]);
  });

  it('respects the limit', () => {
    expect(summarizeEvents(fixture('github-events.json'), 2)).toHaveLength(2);
  });
});

describe('sanitizeActivity', () => {
  it('re-validates cached items and rebuilds their links', () => {
    const cached = [
      {
        action: 'Pushed commits to',
        repo: 'JimmyRaoUF/x',
        repoUrl: 'javascript:alert(1)',
        date: '2026-10-01T00:00:00Z',
      },
      { action: 'Pushed commits to', repo: 'not a repo', date: '2026-10-01T00:00:00Z' },
      { action: 'x'.repeat(100), repo: 'JimmyRaoUF/y', date: '2026-10-01T00:00:00Z' },
      'junk',
    ];
    expect(sanitizeActivity(cached)).toEqual([
      {
        action: 'Pushed commits to',
        repo: 'JimmyRaoUF/x',
        repoUrl: 'https://github.com/JimmyRaoUF/x',
        date: '2026-10-01T00:00:00Z',
      },
    ]);
    expect(sanitizeActivity('nope')).toEqual([]);
  });
});

describe('summarizeRepos', () => {
  const repos = summarizeRepos(fixture('github-user-repos.json'), fixture('github-org-repos.json'));

  it('merges user and organization repositories, drops forks, sorts by last push', () => {
    expect(repos.map((repo) => repo.fullName)).toEqual([
      'JimmyRaoUF/fixture-study-tools',
      'nanjierao/nanjierao.github.io',
      'JimmyRaoUF/fixture-coding-scheme',
    ]);
  });

  it('keeps descriptions as plain text for escaped rendering', () => {
    expect(repos[0]!.description).toBe('Fixture repository used in tests <b>not HTML</b>');
    expect(repos[2]!.archived).toBe(true);
  });

  it('de-duplicates and tolerates bad input', () => {
    const user = fixture('github-user-repos.json');
    expect(summarizeRepos(user, user)).toHaveLength(2);
    expect(summarizeRepos(null, { message: 'Not Found' })).toEqual([]);
  });
});

describe('filterGitHub (fetched text must never fail a deploy)', () => {
  it('drops repositories and activity whose names fail, and clears failing descriptions', async () => {
    const { filterGitHub } = await import('../../scripts/lib/filter-external.ts');
    const repos = summarizeRepos([
      {
        name: 'study-scripts',
        full_name: 'JimmyRaoUF/study-scripts',
        description: 'Scripts and notes from my job search',
        pushed_at: '2026-10-01T00:00:00Z',
      },
      {
        name: 'visa-helper',
        full_name: 'JimmyRaoUF/visa-helper',
        description: null,
        pushed_at: '2026-10-02T00:00:00Z',
      },
      {
        name: 'fine',
        full_name: 'JimmyRaoUF/fine',
        description: 'A plain description',
        pushed_at: '2026-10-03T00:00:00Z',
      },
    ]);
    const activity = [
      {
        action: 'Pushed commits to',
        repo: 'JimmyRaoUF/visa-helper',
        repoUrl: '',
        date: '2026-10-02T00:00:00Z',
      },
      {
        action: 'Pushed commits to',
        repo: 'JimmyRaoUF/fine',
        repoUrl: '',
        date: '2026-10-03T00:00:00Z',
      },
    ];
    const result = filterGitHub(activity, repos);
    expect(result.repos.map((r) => [r.fullName, r.description])).toEqual([
      ['JimmyRaoUF/fine', 'A plain description'],
      ['JimmyRaoUF/study-scripts', null],
    ]);
    expect(result.activity.map((a) => a.repo)).toEqual(['JimmyRaoUF/fine']);
    expect(result.dropped).toBe(3);
  });
});
