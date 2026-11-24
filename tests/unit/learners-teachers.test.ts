// /learners-and-teachers/ (D66): every string the page shows comes from one data module, so the
// checks here cover all of its copy. Numbers must be in content/facts.md, the term is "learner
// model", and the copy has no em dashes.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import * as page from '../../src/data/learners-teachers.ts';
import { NAV } from '../../src/data/site.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const FACTS = readFileSync(join(ROOT, 'content', 'facts.md'), 'utf8').replace(/\*\*/g, '');

/** Every string in the module, however deeply nested. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const COPY = strings(page).filter((text) => !text.startsWith('/') && !/^[a-z0-9-]+$/.test(text));
const LINKS = strings(page).filter((text) => text.startsWith('/'));

describe('copy of /learners-and-teachers/', () => {
  it('shows only numbers that are in facts.md', () => {
    for (const text of COPY) {
      const numbers = (
        text.match(/(?<![\w.])(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?|\.\d+)/g) ?? []
      ).filter((n) => !/^\d$/.test(n));
      for (const number of numbers) {
        const pattern = new RegExp(`(?<![\\d.,])${number.replace(/[.]/g, '\\.')}(?![\\d])`);
        expect(pattern.test(FACTS), `"${number}" in "${text}" is not in facts.md`).toBe(true);
      }
    }
  });

  it('says "learner model" and never "world model"', () => {
    const all = COPY.join(' ');
    expect(all).toContain('learner model');
    expect(all).not.toMatch(/world model/i);
  });

  it('has no em dashes, markers or words CLAUDE.md rules out', () => {
    for (const text of COPY) {
      expect(text).not.toContain('—');
      expect(text).not.toMatch(/TODO|VERIFY|DRAFT/);
      expect(text).not.toMatch(/\b(passionate|cutting-edge|leverage|innovative)\b/i);
    }
  });

  it('keeps the §5.2 caveat next to the inferred share', () => {
    const note = page.GROUNDING_NOTE.join(' ');
    expect(note).toContain('44.7%');
    expect(note).toContain('Inferred does not mean false');
    expect(note).toContain('does not test truth');
  });

  it('quotes the dissertation takeaway word for word', () => {
    const quote = /“([^”]+)”/.exec(page.LEARNER_STUDIES[0]!.found)![1]!;
    expect(FACTS.replace(/\s+/g, ' ')).toContain(quote);
  });
});

describe('publications and links on /learners-and-teachers/', () => {
  const publications = parseYaml(
    readFileSync(join(ROOT, 'src', 'content', 'publications.yaml'), 'utf8'),
  ) as Array<{ id: string; type: string; verify?: boolean; firstAuthor: boolean }>;
  const listed = (id: string) =>
    publications.find((pub) => pub.id === id && pub.type !== 'in-preparation' && !pub.verify);

  it('lists the papers in the order of the outline, all of them published and listed', () => {
    expect([...page.TEACHER_PUBLICATIONS]).toEqual([
      'icalt-2023-context-for-contextualizing',
      'hcii-2022-information-retrieval',
      'icalt-2021-visual-efficiency',
    ]);
    expect([...page.BREADTH_PUBLICATIONS]).toEqual([
      'chi-2020-self-avatars',
      'hcomp-2020-explanation-types',
      'interact-2023-everyday-inspired-movies',
      'icids-2019-emotional-priming',
    ]);
    for (const id of [...page.TEACHER_PUBLICATIONS, ...page.BREADTH_PUBLICATIONS]) {
      expect(listed(id), id).toBeDefined();
    }
    // "three of them as a co-author"
    expect(page.BREADTH_PUBLICATIONS.filter((id) => !listed(id)!.firstAuthor)).toHaveLength(3);
  });

  it('links only to pages and citations that exist', () => {
    expect(LINKS.length).toBeGreaterThan(5);
    for (const link of LINKS) {
      const [path, anchor] = link.split('#') as [string, string | undefined];
      const research = /^\/research\/([a-z0-9-]+)\/$/.exec(path);
      const build = /^\/builds\/([a-z0-9-]+)\/$/.exec(path);
      if (research) {
        const base = join(ROOT, 'src', 'content', 'themes', research[1]!);
        expect(existsSync(`${base}.md`) || existsSync(`${base}.mdx`), link).toBe(true);
      } else if (build) {
        expect(existsSync(join(ROOT, 'src', 'content', 'builds', `${build[1]}.md`)), link).toBe(
          true,
        );
      } else {
        expect(path, link).toBe('/publications/');
        expect(listed(anchor!), link).toBeDefined();
      }
    }
  });

  it('has its own tab, named as the page is', () => {
    expect(NAV.find((item) => item.href === '/learners-and-teachers/')?.label).toBe(page.TITLE);
  });
});
