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

/** The folder the notes collection reads: the real notes, or the synthetic ones for the tests. */
export function notesDir(): string {
  return process.env.NOTES_FIXTURES === '1' ? 'tests/fixtures/notes' : 'src/content/notes';
}

/** Chinese characters, CJK punctuation and full-width forms. */
const CJK = '\\p{Script=Han}\\u3000-\\u303F\\uFF00-\\uFFEF';
/** What may sit between two stretches of Chinese and still belong to them. */
const GLUE = '\\s\\d\\u00B7\\u2014\\u2018-\\u201F\\u2026';
/** One run of Chinese, with an opening quote before it and a closing quote after it. */
const CHINESE_RUN = new RegExp(
  `([\\u2018\\u201C]?[${CJK}]+(?:[${GLUE}]*[${CJK}]+)*[\\u2019\\u201D]?)`,
  'u',
);

/**
 * Bold, written **like this** in a note: the only formatting a note has. The words inside start
 * and end with a character that is not a space, and end at the first closing ** ("??" is lazy:
 * "**A** and **B**" is two bold parts, not one).
 */
const BOLD = /\*\*(\S(?:.*?\S)??)\*\*/u;
const EVERY_BOLD = new RegExp(BOLD.source, 'gu');

/** A line's words as a reader sees them: the line without its bold markers. */
export function noteText(line: string): string {
  return line.replace(EVERY_BOLD, '$1');
}

/** Whether a line has a ** without its partner, which would show as asterisks. */
export function hasLoneBoldMarker(line: string): boolean {
  return line.replace(EVERY_BOLD, '').includes('**');
}

/** The bold lead an item starts with, when more of the item follows it. */
export function noteLead(line: string): string | undefined {
  return new RegExp(`^${BOLD.source}\\s+\\S`, 'u').exec(line)?.[1];
}

export interface NoteRun {
  text: string;
  lang?: 'zh-CN';
  strong?: true;
}

/**
 * One line of a note, marked for language (WCAG 2.2, 3.1.2) without guessing at the line as a
 * whole, and with its bold parts marked as such. A line with Chinese characters and no Latin
 * letters is all Chinese and gets lang="zh-CN" itself, its numbers and punctuation included
 * (2026年, 5.2公里, 12.5%, ……). In a mixed line each run of Chinese gets its own and the rest is
 * the page's English, so a Chinese sentence with English terms and an English sentence with a
 * Chinese phrase both come out right. The runs join back into the line's words (noteText),
 * character for character.
 */
export function noteLine(line: string): { lang?: 'zh-CN'; runs: NoteRun[] } {
  const parts = line
    .split(BOLD)
    .map((text, i) => ({ text, strong: i % 2 === 1 }))
    .filter((part) => part.text !== '');
  const text = parts.map((part) => part.text).join('');
  const bold = (strong: boolean) => (strong ? { strong: true as const } : {});
  if (/\p{Script=Han}/u.test(text) && !/\p{Script=Latin}/u.test(text))
    return {
      lang: 'zh-CN',
      runs: parts.map((part) => ({ text: part.text, ...bold(part.strong) })),
    };
  const runs: NoteRun[] = parts.flatMap((part) =>
    part.text
      .split(CHINESE_RUN)
      .map((piece, i) => ({
        text: piece,
        ...(i % 2 === 1 ? { lang: 'zh-CN' as const } : {}),
        ...bold(part.strong),
      }))
      .filter((run) => run.text !== ''),
  );
  if (runs.length === 1 && runs[0]?.lang && !runs[0].strong)
    return { lang: 'zh-CN', runs: [{ text }] };
  return { runs };
}
