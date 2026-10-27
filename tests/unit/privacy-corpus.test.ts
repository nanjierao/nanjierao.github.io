// Checks every entry of the labeled corpus in privacy-corpus.ts against the privacy rules: one test
// per rule family, failure messages name the sentence. All inputs are fictional.
import { describe, expect, it } from 'vitest';
import {
  type Finding,
  findAddresses,
  findEmails,
  findPhones,
  findSection15Terms,
  isPublishableVideoTitle,
  normalizeForScan,
  stripLicenseComments,
} from '../../scripts/lib/privacy-rules.ts';
import { type CorpusFamily, corpus, knownLimits } from './privacy-corpus.ts';

/** All four rule sets, the way scripts/check-privacy.ts runs them on one file. */
function scanAll(input: string, code = false): Finding[] {
  const text = normalizeForScan(code ? stripLicenseComments(input) : input);
  return [
    ...findPhones(text),
    ...findEmails(text),
    ...findAddresses(text),
    ...findSection15Terms(text, { code }),
  ];
}

function flagFindings(family: CorpusFamily, text: string): Finding[] {
  switch (family.fn) {
    case 'phones':
      return findPhones(text);
    case 'emails':
      return findEmails(text);
    case 'addresses':
      return findAddresses(text);
    case 'terms':
      return findSection15Terms(text);
    case 'code':
      return scanAll(text, true);
    case 'videoTitle':
      return isPublishableVideoTitle(text)
        ? []
        : [{ category: 'video title', match: text, index: 0 }];
  }
}

/** A short description of what went wrong with one entry, or null when it behaves. */
function problem(family: CorpusFamily, text: string, expected: 'flag' | 'pass'): string | null {
  if (expected === 'flag') {
    const found = flagFindings(family, text);
    const wanted = family.category
      ? found.filter((f) => f.category.includes(family.category!))
      : found;
    if (wanted.length > 0) return null;
    return `not flagged${found.length ? ` as ${family.category} (got ${found.map((f) => f.category).join(', ')})` : ''}: ${JSON.stringify(text)}`;
  }
  const found =
    family.fn === 'videoTitle' ? flagFindings(family, text) : scanAll(text, family.fn === 'code');
  if (found.length === 0) return null;
  return `flagged ${found.map((f) => `[${f.category}] ${JSON.stringify(f.match)}`).join(', ')}: ${JSON.stringify(text)}`;
}

describe('privacy rules on the labeled corpus', () => {
  for (const family of corpus) {
    it(`${family.name}: ${family.flag.length} to flag, ${family.pass.length} to pass`, () => {
      const problems = [
        ...family.flag.map((text) => problem(family, text, 'flag')),
        ...family.pass.map((text) => problem(family, text, 'pass')),
      ].filter((p): p is string => p !== null);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }

  it('reports the known limits (not asserted)', () => {
    for (const limit of knownLimits) {
      const family = corpus.find((f) => f.name === limit.family);
      expect(family, `knownLimits names an unknown family: ${limit.family}`).toBeDefined();
      const wrong = problem(family!, limit.text, limit.expected);
      if (wrong) console.info(`known limit (${limit.family}): ${wrong} — ${limit.reason}`);
    }
  });

  it('normalizes idempotently, so match positions do not drift', () => {
    const extra = [
      'I&amp;#39;m; &amp;nbsp; %2540 &#x0040;&#064; ‘’ʼ ‐‑ １３８ ……',
      'a b &nbsp;&NBSP; é ’́ ‑́',
    ];
    const texts = [
      ...corpus.flatMap((f) => [...f.flag, ...f.pass]),
      ...knownLimits.map((l) => l.text),
      ...extra,
    ];
    for (const text of texts) {
      const once = normalizeForScan(text);
      expect(normalizeForScan(once), JSON.stringify(text)).toBe(once);
      const positions = (s: string) => scanAll(s).map((f) => `${f.index}:${f.match}`);
      expect(positions(once), JSON.stringify(text)).toEqual(positions(text));
    }
  });
});
