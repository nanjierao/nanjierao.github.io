// Site-wide constants. Every fact here comes from content/facts.md (section noted).
// Plain data only: build scripts import this file directly with Node.

export const SITE_URL = 'https://nanjierao.github.io';

export const PERSON = {
  /** facts.md §1: display name, used on first mention. */
  displayName: 'Nanjie (Jimmy) Rao',
  /** facts.md §1: scholarly name, matches Google Scholar and the papers. */
  scholarlyName: 'Nanjie Rao',
  givenName: 'Nanjie',
  familyName: 'Rao',
  alternateName: 'Jimmy Rao',
  /** facts.md §1: city level only. */
  city: 'Gainesville, Florida',
  // TODO(jimmy): pick the one public email address the site shows (facts.md §1). Until then the
  // intro strip and /about show no email link, and check:privacy allows no email address.
  email: null as string | null,
} as const;

/**
 * Intro-strip line. facts.md §3 option 4 (dissertation-aligned), a placeholder until Jimmy picks
 * the headline (S1 prompt). TODO(jimmy): choose the headline in facts.md §3.
 */
export const POSITIONING =
  'An AI tutor teaches from what reaches it about a student. I study where that information should come from — asking, teaching, or the records students already produce.';

/**
 * Research umbrella line: the default from facts.md §5 (Jimmy's Sept 2026 research statement),
 * in first person. TODO(jimmy): confirm or replace (D27, D45).
 */
export const UMBRELLA =
  'An AI system that adapts to a person must first know something about them, by asking or by reading records the person already produced. My research asks which to rely on, how accurate and well grounded the result is, and what it costs in privacy.';

export const DEFAULT_DESCRIPTION =
  'Nanjie (Jimmy) Rao, human-computer interaction researcher at the University of Florida: where an AI tutor’s knowledge of a student should come from, and how well grounded it is.';

export interface ElsewhereLink {
  id: 'scholar' | 'github' | 'youtube' | 'zhihu';
  label: string;
  href: string;
  /** Extra words for screen readers and tooltips. */
  description: string;
}

/** facts.md §13 (D50): Google Scholar, GitHub (JimmyRaoUF), YouTube, Zhihu. */
export const ELSEWHERE: readonly ElsewhereLink[] = [
  {
    id: 'scholar',
    label: 'Google Scholar',
    href: 'https://scholar.google.com/citations?user=EBetHqQAAAAJ',
    description: 'Publications and citations on Google Scholar',
  },
  {
    id: 'github',
    label: 'GitHub',
    href: 'https://github.com/JimmyRaoUF',
    description: 'Code on GitHub (JimmyRaoUF)',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@drluckydadredl',
    description: 'YouTube channel “Dr. Lucky Dad - Research and Engineer the Dad Life”',
  },
  {
    id: 'zhihu',
    label: 'Zhihu',
    href: 'https://www.zhihu.com/people/daozhu',
    description: 'Writing in Chinese on Zhihu (知乎)',
  },
];

export const NAV = [
  { href: '/research/', label: 'Research' },
  { href: '/publications/', label: 'Publications' },
  { href: '/builds/', label: 'Builds' },
  { href: '/teaching/', label: 'Teaching' },
  { href: '/cv/', label: 'CV' },
  { href: '/blog/', label: 'Blog' },
  { href: '/about/', label: 'About' },
] as const;

/** Switches for content that waits on Jimmy's approval. */
export const FLAGS = {
  /** D28: list the in-preparation manuscripts ("Working papers") only once Jimmy approves. */
  showWorkingPapers: false,
  /**
   * D31 vs D50: channel thumbnails may show family members or children, which D31 keeps off the
   * site. The latest-video card shows a neutral poster until Jimmy turns this on.
   * TODO(jimmy): decide whether thumbnails from your channel may appear on the site.
   */
  showLatestVideoThumbnail: false,
} as const;
