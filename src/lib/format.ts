// Formatting shared by pages and the small client scripts. Dates are formatted in UTC from
// calendar values so a build in one time zone and a browser in another print the same day.

const MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const SHORT_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026" → "2026"; "2026-10" → "October 2026"; "2026-11-19" → "Nov 19, 2026". */
export function formatPartialDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year) return value;
  if (!month) return String(year);
  if (!day) return MONTH_YEAR.format(Date.UTC(year, month - 1, 1));
  return SHORT_DAY.format(Date.UTC(year, month - 1, day));
}

const SHORT_MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** "2026-11-19" + "2026-11-20" → "Nov 19–20, 2026". */
export function formatDayRange(start: string, end?: string): string {
  if (!end || end === start) return formatPartialDate(start);
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return `${start} – ${end}`;
  const month = (m: number) => SHORT_MONTH.format(Date.UTC(2000, m - 1, 1));
  if (sy === ey && sm === em) return `${month(sm)} ${sd}–${ed}, ${sy}`;
  if (sy === ey) return `${month(sm)} ${sd} – ${month(em)} ${ed}, ${sy}`;
  return `${formatPartialDate(start)} – ${formatPartialDate(end)}`;
}

/** A timestamp or Date as "Oct 25, 2026" (UTC). */
export function formatDay(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '' : SHORT_DAY.format(date);
}

/** YYYY-MM-DD for a <time datetime> attribute. */
export function isoDay(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/**
 * Pair each author with the separator before it, the way content/facts.md writes author
 * lists: "A, & B" for two, "A, B, & C" for more, and "A, et al." when the list ends that way.
 */
export function authorParts(authors: readonly string[]): Array<{ before: string; name: string }> {
  return authors.map((name, i) => {
    if (i === 0) return { before: '', name };
    const isLast = i === authors.length - 1;
    return { before: isLast && name !== 'et al.' ? ', & ' : ', ', name };
  });
}

export function joinAuthors(authors: readonly string[]): string {
  return authorParts(authors)
    .map((part) => part.before + part.name)
    .join('');
}

/** Jimmy's name in author lists (facts.md §1: "Rao, N."; one CHI paper lists "Rao, N. J."). */
export function isSelf(author: string): boolean {
  return /^Rao, N\.(?: J\.)?$/.test(author);
}

/** Sort key for partial dates: "2026" < "2026-10" < "2026-11-19". */
export function comparePartialDatesDesc(a: string, b: string): number {
  return b.localeCompare(a);
}
