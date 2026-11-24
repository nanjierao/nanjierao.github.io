// Daily notes (D71): plain helpers for the /notes/ page and the home page's card. No Astro
// imports, so the unit tests and the collection config can use them.

/** A note's id is its date, YYYY-MM-DD, and must be a real calendar day. */
export function isNoteDate(id: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(id);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function utc(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1);
}

const DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-11-25" → "Wednesday, November 25" (the month heading above it gives the year). */
export function formatNoteDay(id: string): string {
  return DAY.format(utc(id));
}

/** "2026-11" → "November 2026". */
export function formatNoteMonth(month: string): string {
  return MONTH.format(utc(`${month}-01`));
}

/** Notes grouped by month: newest month first, and the newest day first within each month. */
export function groupNotesByMonth<T extends { id: string }>(
  notes: readonly T[],
): Array<{ month: string; notes: T[] }> {
  const groups: Array<{ month: string; notes: T[] }> = [];
  for (const note of [...notes].sort((a, b) => b.id.localeCompare(a.id))) {
    const month = note.id.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) last.notes.push(note);
    else groups.push({ month, notes: [note] });
  }
  return groups;
}

/**
 * The language of one line, for its lang attribute (WCAG 2.2, 3.1.2): Chinese when its Han
 * characters reach one and a half times its Latin words, so a Chinese sentence with an English
 * term stays Chinese and an English sentence with a Chinese term stays English. Undefined means
 * the page's English.
 */
export function lineLang(line: string): 'zh-CN' | undefined {
  const han = line.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latinWords = line.match(/\p{Script=Latin}+/gu)?.length ?? 0;
  return han > 0 && 2 * han >= 3 * latinWords ? 'zh-CN' : undefined;
}
