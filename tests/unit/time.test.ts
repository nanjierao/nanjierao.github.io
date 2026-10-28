import { describe, expect, it } from 'vitest';
import { dayIn, isIsoDay, tenseOf, wordingFor } from '../../src/lib/time.ts';

// DTRUE 2026: UF Jacksonville campus, Nov 19–20, 2026 (facts.md §5.3, §11; D26).
const DTRUE = { start: '2026-11-19', end: '2026-11-20', timeZone: 'America/New_York' };
const WORDING = {
  upcoming: 'Upcoming oral presentation at DTRUE 2026',
  past: 'Presented at DTRUE 2026',
};

describe('tenseOf', () => {
  it('is upcoming before the event', () => {
    expect(tenseOf(DTRUE, new Date('2026-10-27T12:00:00Z'))).toBe('upcoming');
    expect(tenseOf(DTRUE, new Date('2026-11-18T23:59:00-05:00'))).toBe('upcoming');
  });

  it('is ongoing on both days of the event', () => {
    expect(tenseOf(DTRUE, new Date('2026-11-19T00:00:00-05:00'))).toBe('ongoing');
    expect(tenseOf(DTRUE, new Date('2026-11-20T23:59:59-05:00'))).toBe('ongoing');
  });

  it('is past from the day after 2026-11-20 in Jacksonville', () => {
    expect(tenseOf(DTRUE, new Date('2026-11-21T00:00:00-05:00'))).toBe('past');
    expect(tenseOf(DTRUE, new Date('2027-03-01T12:00:00Z'))).toBe('past');
  });

  it('compares calendar days in the event time zone, not UTC', () => {
    // 03:00 UTC on Nov 21 is still 22:00 on Nov 20 in Jacksonville.
    expect(tenseOf(DTRUE, new Date('2026-11-21T03:00:00Z'))).toBe('ongoing');
    // 05:00 UTC on Nov 21 is midnight in Jacksonville (EST, UTC−5).
    expect(tenseOf(DTRUE, new Date('2026-11-21T05:00:00Z'))).toBe('past');
  });

  it('treats a one-day event without an end date', () => {
    const oneDay = { start: '2026-11-19' };
    expect(tenseOf(oneDay, new Date('2026-11-19T15:00:00Z'))).toBe('ongoing');
    expect(tenseOf(oneDay, new Date('2026-11-20T15:00:00Z'))).toBe('past');
  });

  it('rejects malformed or reversed dates', () => {
    expect(() => tenseOf({ start: '2026-11-31' }, new Date())).toThrow();
    expect(() => tenseOf({ start: 'Nov 19' }, new Date())).toThrow();
    expect(() => tenseOf({ start: '2026-11-20', end: '2026-11-19' }, new Date())).toThrow();
  });
});

describe('wordingFor', () => {
  it('says "Upcoming" through Nov 20, 2026 and "Presented" after (D26, S4)', () => {
    expect(wordingFor(DTRUE, WORDING, new Date('2026-11-01T12:00:00Z'))).toBe(WORDING.upcoming);
    expect(wordingFor(DTRUE, WORDING, new Date('2026-11-20T18:00:00-05:00'))).toBe(
      WORDING.upcoming,
    );
    expect(wordingFor(DTRUE, WORDING, new Date('2026-11-21T09:00:00-05:00'))).toBe(WORDING.past);
  });

  it('uses the ongoing wording when one is given', () => {
    const withOngoing = { ...WORDING, ongoing: 'Presenting at DTRUE 2026 this week' };
    expect(wordingFor(DTRUE, withOngoing, new Date('2026-11-19T12:00:00-05:00'))).toBe(
      withOngoing.ongoing,
    );
  });
});

describe('helpers', () => {
  it('validates ISO days', () => {
    expect(isIsoDay('2026-11-20')).toBe(true);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('2026-11')).toBe(false);
  });

  it('reads the calendar day in a time zone', () => {
    expect(dayIn(new Date('2026-11-21T03:00:00Z'), 'America/New_York')).toBe('2026-11-20');
    expect(dayIn(new Date('2026-11-21T03:00:00Z'), 'Asia/Shanghai')).toBe('2026-11-21');
  });
});
