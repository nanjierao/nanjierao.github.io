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
 * and end with a character that is not a space and hold no asterisk, and no letter, digit, slash
 * or asterisk touches the markers from outside. So "2**10", "f(**kwargs)", a glob such as
 * "src/**" and "***x***" are not bold: their ** stay, and the schema refuses the line, so Jimmy
 * is asked instead of his asterisks disappearing.
 */
const BOLD = /(?<![A-Za-z0-9*/])\*\*([^\s*](?:[^*]*[^\s*])?)\*\*(?![A-Za-z0-9*])/u;
const EVERY_BOLD = new RegExp(BOLD.source, 'gu');
/** The end of a sentence (. ! ? 。！？), perhaps with a closing quote or bracket after it. */
const SENTENCE_END = /[.!?。！？]['"’”)）」』]?$/u;
/** The end of a Chinese sentence, after which the next one starts without a space. */
const CHINESE_SENTENCE_END = /[。！？]['"’”)）」』]?$/u;

/** A line's words as a reader sees them: the line without its bold markers. */
export function noteText(line: string): string {
  return line.replace(EVERY_BOLD, '$1');
}

/** Whether a line has a ** that does not pair up as bold, which would show as asterisks. */
export function hasLoneBoldMarker(line: string): boolean {
  return line.replace(EVERY_BOLD, '').includes('**');
}

/**
 * The bold lead an item starts with: a whole sentence in bold, followed by more of the item,
 * after a space or, in Chinese, straight after the sentence's end. A bold label ("**Did:**")
 * or word ("**React** was too big") is not a lead. The home card shows an item's lead alone.
 */
export function noteLead(line: string): string | undefined {
  const match = new RegExp(`^${BOLD.source}`, 'u').exec(line);
  const lead = match?.[1];
  if (!match || !lead || !SENTENCE_END.test(lead)) return undefined;
  const rest = line.slice(match[0].length);
  const follows = /^\s+\S/u.test(rest) || (CHINESE_SENTENCE_END.test(lead) && /^\S/u.test(rest));
  return follows ? lead : undefined;
}

export interface NoteRun {
  text: string;
  lang?: 'zh-CN';
}

/** A stretch of a line, bold or not, in runs of language. */
export interface NotePart {
  strong?: true;
  runs: NoteRun[];
}

/**
 * One line of a note: its bold parts, each one element on the page, and its language
 * (WCAG 2.2, 3.1.2), marked without guessing at the line as a whole. A line with Chinese
 * characters and no Latin letters is all Chinese and gets lang="zh-CN" itself, its numbers and
 * punctuation included (2026年, 5.2公里, 12.5%, ……). In a mixed line each run of Chinese gets its
 * own and the rest is the page's English, so a Chinese sentence with English terms and an
 * English sentence with a Chinese phrase both come out right. The runs join back into the
 * line's words (noteText), character for character.
 */
export function noteLine(line: string): { lang?: 'zh-CN'; parts: NotePart[] } {
  const pieces = line
    .split(BOLD)
    .map((text, i) => ({ text, strong: i % 2 === 1 }))
    .filter((piece) => piece.text !== '');
  const text = pieces.map((piece) => piece.text).join('');
  const part = (strong: boolean, runs: NoteRun[]): NotePart =>
    strong ? { strong: true, runs } : { runs };
  if (/\p{Script=Han}/u.test(text) && !/\p{Script=Latin}/u.test(text))
    return {
      lang: 'zh-CN',
      parts: pieces.map((piece) => part(piece.strong, [{ text: piece.text }])),
    };
  const parts = pieces.map((piece) =>
    part(
      piece.strong,
      piece.text
        .split(CHINESE_RUN)
        .map((run, i): NoteRun => (i % 2 === 1 ? { text: run, lang: 'zh-CN' } : { text: run }))
        .filter((run) => run.text !== ''),
    ),
  );
  const only = parts.length === 1 ? parts[0] : undefined;
  if (only && !only.strong && only.runs.length === 1 && only.runs[0]?.lang)
    return { lang: 'zh-CN', parts: [{ runs: [{ text }] }] };
  return { parts };
}
