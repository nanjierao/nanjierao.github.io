// Time-aware wording (D26). Dated items carry their dates in content; pages pick the wording
// at build time, and a tiny client-side check (src/scripts/time-aware.ts) updates it between
// deploys. The build-time text is the no-JS fallback. This module runs in both places.

export type Tense = 'upcoming' | 'ongoing' | 'past';

export interface DatedEvent {
  /** First day, as YYYY-MM-DD in the event's own time zone. */
  start: string;
  /** Last day (inclusive), as YYYY-MM-DD. Defaults to `start`. */
  end?: string;
  /** IANA time zone the dates refer to. */
  timeZone?: string;
}

export interface TenseWording {
  upcoming: string;
  /** Shown while the event is under way; falls back to `upcoming` when absent. */
  ongoing?: string;
  past: string;
}

export const DEFAULT_TIME_ZONE = 'America/New_York';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The calendar day of `now` in `timeZone`, as YYYY-MM-DD. */
export function dayIn(now: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Whether an event is upcoming, under way, or over at `now`, comparing calendar days in the
 * event's time zone. An event stays "ongoing" through the whole of its last day.
 */
export function tenseOf(event: DatedEvent, now: Date): Tense {
  const end = event.end ?? event.start;
  if (!isIsoDay(event.start) || !isIsoDay(end)) {
    throw new Error(`Dates must be YYYY-MM-DD: ${event.start} – ${end}`);
  }
  if (end < event.start) throw new Error(`End ${end} is before start ${event.start}`);
  const today = dayIn(now, event.timeZone ?? DEFAULT_TIME_ZONE);
  if (today < event.start) return 'upcoming';
  if (today > end) return 'past';
  return 'ongoing';
}

export function wordingFor(event: DatedEvent, wording: TenseWording, now: Date): string {
  const tense = tenseOf(event, now);
  if (tense === 'past') return wording.past;
  if (tense === 'ongoing') return wording.ongoing ?? wording.upcoming;
  return wording.upcoming;
}
