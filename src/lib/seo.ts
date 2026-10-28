import { ELSEWHERE, PERSON, SITE_URL } from '../data/site.ts';

/** Canonical URL on https://nanjierao.github.io, with the trailing slash GitHub Pages serves. */
export function canonicalUrl(pathname: string): string {
  let path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const last = path.split('/').at(-1) ?? '';
  if (!last.includes('.') && !path.endsWith('/')) path = `${path}/`;
  return new URL(path, SITE_URL).href;
}

/** JSON-LD `Person` (SITE_PLAN §12, D50): sameAs Google Scholar, GitHub, YouTube, Zhihu. */
export function personJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: PERSON.scholarlyName,
    alternateName: [PERSON.displayName, PERSON.alternateName],
    givenName: PERSON.givenName,
    familyName: PERSON.familyName,
    url: `${SITE_URL}/`,
    jobTitle: 'Ph.D. candidate in Human-Centered Computing',
    affiliation: {
      '@type': 'CollegeOrUniversity',
      name: 'University of Florida',
      url: 'https://www.ufl.edu/',
    },
    sameAs: ELSEWHERE.map((link) => link.href),
  };
}

/** Serialize JSON-LD for a <script> element without letting content close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
