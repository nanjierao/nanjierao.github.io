import { describe, expect, it } from 'vitest';
import {
  authorParts,
  formatDayRange,
  formatPartialDate,
  isSelf,
  joinAuthors,
} from '../../src/lib/format.ts';
import { canonicalUrl, jsonLdString, personJsonLd } from '../../src/lib/seo.ts';
import { ELSEWHERE } from '../../src/data/site.ts';

describe('author lists match facts.md §6', () => {
  it('joins two, many, and "et al." lists', () => {
    expect(joinAuthors(['Rao, N.', 'Chu, S. L.'])).toBe('Rao, N., & Chu, S. L.');
    expect(joinAuthors(['Rao, N.', 'Chu, S. L.', 'Chenore, R.'])).toBe(
      'Rao, N., Chu, S. L., & Chenore, R.',
    );
    expect(joinAuthors(['Rao, N.', 'et al.'])).toBe('Rao, N., et al.');
    expect(joinAuthors(['Rao, N.'])).toBe('Rao, N.');
    expect(authorParts(['A', 'B'])).toEqual([
      { before: '', name: 'A' },
      { before: ', & ', name: 'B' },
    ]);
  });

  it("recognizes Jimmy's name in both forms", () => {
    expect(isSelf('Rao, N.')).toBe(true);
    expect(isSelf('Rao, N. J.')).toBe(true);
    expect(isSelf('Rao, Z.')).toBe(false);
  });
});

describe('dates', () => {
  it('formats partial dates only as precisely as given', () => {
    expect(formatPartialDate('2026')).toBe('2026');
    expect(formatPartialDate('2026-10')).toBe('October 2026');
    expect(formatPartialDate('2026-11-19')).toBe('Nov 19, 2026');
  });

  it('formats day ranges', () => {
    expect(formatDayRange('2026-11-19', '2026-11-20')).toBe('Nov 19–20, 2026');
    expect(formatDayRange('2026-11-30', '2026-12-01')).toBe('Nov 30 – Dec 1, 2026');
    expect(formatDayRange('2026-11-19')).toBe('Nov 19, 2026');
  });
});

describe('SEO', () => {
  it('builds canonical URLs on nanjierao.github.io with trailing slashes', () => {
    expect(canonicalUrl('/')).toBe('https://nanjierao.github.io/');
    expect(canonicalUrl('/research/grounding')).toBe(
      'https://nanjierao.github.io/research/grounding/',
    );
    expect(canonicalUrl('/rss.xml')).toBe('https://nanjierao.github.io/rss.xml');
  });

  it('describes the Person with sameAs Scholar, GitHub, YouTube and Zhihu (D50)', () => {
    const person = personJsonLd();
    expect(person['@type']).toBe('Person');
    expect(person.name).toBe('Nanjie Rao');
    expect(person.sameAs).toEqual([
      'https://scholar.google.com/citations?user=EBetHqQAAAAJ',
      'https://github.com/JimmyRaoUF',
      'https://www.youtube.com/@drluckydadredl',
      'https://www.zhihu.com/people/daozhu',
    ]);
    expect(ELSEWHERE.map((link) => link.id)).toEqual(['scholar', 'github', 'youtube', 'zhihu']);
  });

  it('cannot close its script element', () => {
    expect(jsonLdString({ x: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
});
