// Client-side half of D26: re-check every time-aware label against the visitor's clock, so a
// page built before an event reads correctly after it, even if no rebuild has run since.
import { wordingFor } from '../lib/time.ts';

export function updateTimeAware(root: ParentNode = document, now: Date = new Date()): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-time-aware]')) {
    const { start, end, timeZone, upcoming, ongoing, past } = el.dataset;
    if (!start || !upcoming || !past) continue;
    try {
      const text = wordingFor({ start, end, timeZone }, { upcoming, ongoing, past }, now);
      if (el.textContent !== text) el.textContent = text;
    } catch {
      // Keep the build-time text if the data is malformed.
    }
  }
}

if (typeof document !== 'undefined') updateTimeAware();
