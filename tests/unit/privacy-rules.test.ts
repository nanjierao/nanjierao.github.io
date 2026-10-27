// Samples here are fictional on purpose (555-01xx numbers, example domains, made-up streets).
// This file is excluded from the repository scan for that reason.
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  describeImageMetadata,
  exifHasGps,
  findAddresses,
  findEmails,
  findPhones,
  findSection15Terms,
  isPublishableText,
  lineOf,
  mask,
} from '../../scripts/lib/privacy-rules.ts';

describe('phone numbers', () => {
  it('finds common formats', () => {
    expect(findPhones('Call (212) 555-2368 today')).toHaveLength(1);
    expect(findPhones('tel: +1 212.555.2368')).not.toHaveLength(0);
    expect(findPhones('手机 13800138000')).toHaveLength(1);
    expect(findPhones('<a href="tel:+12125552368">')).not.toHaveLength(0);
  });

  it('allows the 555-0100–0199 range reserved for fiction', () => {
    expect(findPhones('(212) 555-0123')).toHaveLength(0);
  });

  it('ignores numbers that are not phone numbers', () => {
    const text =
      'NSF CAREER #1942937; pp. 160–169; 395-404; 2026-11-20; N = 24; 1,130 units; r = .34; COP 3530; 0.11 points; 2018–21';
    expect(findPhones(text)).toEqual([]);
  });
});

describe('email addresses', () => {
  it('flags unexpected addresses', () => {
    expect(findEmails('write to jane.doe@university.edu')).toHaveLength(1);
  });

  it('allows the chosen public address, reserved domains and noreply addresses', () => {
    expect(findEmails('me@university.edu', ['me@university.edu'])).toHaveLength(0);
    expect(findEmails('someone@example.com, x@site.test')).toHaveLength(0);
    expect(findEmails('42618679+someone@users.noreply.github.com')).toHaveLength(0);
  });

  it('ignores retina image names and package scopes', () => {
    expect(findEmails('logo@2x.png and @fontsource/inter and @astrojs/react')).toHaveLength(0);
  });
});

describe('street addresses', () => {
  it('flags street lines, unit numbers and state + ZIP', () => {
    expect(findAddresses('1234 NW Example Street')).toHaveLength(1);
    expect(findAddresses('Apt 4B')).toHaveLength(1);
    expect(findAddresses('Gainesville, FL 32601')).toHaveLength(1);
  });

  it('ignores ordinary text with numbers', () => {
    expect(findAddresses('Study 2 had 77 initial participants; 32 retained.')).toEqual([]);
    expect(findAddresses('Gainesville, Florida')).toEqual([]);
  });
});

describe('facts.md §15 terms', () => {
  it('flags the categories', () => {
    const cases = [
      'my GPA was high',
      'visa status',
      'work authorization',
      'OPT extension',
      'my daughter loves this',
      'salary expectations',
      'job search update',
      'willing to relocate',
      'cited by 120',
      '我的女儿',
    ];
    for (const text of cases) expect(findSection15Terms(text), text).not.toHaveLength(0);
  });

  it('flags the retired dissertation framing (facts.md §5.1)', () => {
    expect(findSection15Terms('a decision matrix')).toHaveLength(1);
    expect(findSection15Terms('18% name-only')).toHaveLength(1);
  });

  it('does not flag ordinary research language', () => {
    const text =
      'F1 score; the opt-in consent; Dr. Lucky Dad channel; interest development Phase; 29% said nothing beyond the name; Optical engineering';
    expect(findSection15Terms(text)).toEqual([]);
  });

  it('gates fetched titles', () => {
    expect(isPublishableText('Testing a parenting tip')).toBe(true);
    expect(isPublishableText('My son tries the tip')).toBe(false);
  });
});

describe('image metadata', () => {
  it('detects GPS in EXIF written by a camera-like pipeline', async () => {
    const withGps = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#888' },
    })
      .jpeg()
      .withExif({
        IFD0: { Make: 'Fixture' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '29/1 38/1 0/1' },
      })
      .toBuffer();
    const meta = await sharp(withGps).metadata();
    expect(meta.exif && exifHasGps(meta.exif)).toBe(true);
    expect(describeImageMetadata(meta).hasLocation).toBe(true);
  });

  it('passes EXIF without location, and images without metadata', async () => {
    const noGps = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'Fixture' } })
      .toBuffer();
    const meta = await sharp(noGps).metadata();
    expect(describeImageMetadata(meta)).toMatchObject({ hasExif: true, hasLocation: false });

    const bare = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } })
      .webp()
      .toBuffer();
    expect(describeImageMetadata(await sharp(bare).metadata())).toMatchObject({
      hasExif: false,
      hasLocation: false,
    });
  });
});

describe('helpers', () => {
  it('finds line numbers and masks matches for public logs', () => {
    expect(lineOf('a\nb\nc', 4)).toBe(3);
    expect(mask('jane.doe@university.edu')).toBe('jane…du');
  });
});
