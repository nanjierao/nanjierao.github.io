// Pattern rules for `npm run check:privacy` (D39, D31) and the build-time filter on fetched
// text. Pure functions so Vitest can exercise them with obviously fictional samples
// (555-01xx phone numbers, example.com addresses).

export interface Finding {
  category: string;
  match: string;
  index: number;
}

// ---------------------------------------------------------------- phone numbers

const PHONE_PATTERNS: RegExp[] = [
  // North American numbers with separators: (352) 555-0123, 352-555-0123, +1 352.555.0123
  /(?<![\w.+-])(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w-])/g,
  // International numbers written with a leading plus and separators.
  /(?<![\w+])\+(?:[2-9]\d{0,2})[\s.-]\(?\d{1,4}\)?(?:[\s.-]\d{2,5}){2,4}(?![\w-])/g,
  // Mainland China mobile numbers: 11 digits starting 13–19.
  /(?<![\d.-])1[3-9]\d{9}(?![\d-])/g,
  // Telephone links.
  /\btel:[+\d][\d\s().-]{5,}/gi,
];

/** 555-0100 through 555-0199 are reserved for fiction in North America. */
function isFictionalPhone(match: string): boolean {
  return /555[\s.-]?01\d{2}$/.test(match.replace(/[^\d\s.-]/g, ''));
}

export function findPhones(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const pattern of PHONE_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      if (isFictionalPhone(m[0])) continue;
      findings.push({ category: 'phone number', match: m[0], index: m.index ?? 0 });
    }
  }
  return findings;
}

// ---------------------------------------------------------------- email addresses

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const FILE_LIKE_TLD =
  /\.(?:png|jpe?g|gif|svg|webp|avif|ico|js|mjs|ts|tsx|css|json|md|html?|woff2?)$/i;
const RESERVED_DOMAINS =
  /@(?:[\w-]+\.)*(?:example\.(?:com|org|net)|[\w-]+\.(?:test|example|invalid))$/i;
const ALWAYS_ALLOWED = [/@users\.noreply\.github\.com$/i, /^noreply@anthropic\.com$/i];

export function findEmails(text: string, allowed: readonly string[] = []): Finding[] {
  const allow = new Set(allowed.map((e) => e.toLowerCase()));
  const findings: Finding[] = [];
  for (const m of text.matchAll(EMAIL)) {
    const email = m[0];
    if (FILE_LIKE_TLD.test(email)) continue; // e.g. logo@2x.png
    if (RESERVED_DOMAINS.test(email)) continue;
    if (ALWAYS_ALLOWED.some((re) => re.test(email))) continue;
    if (allow.has(email.toLowerCase())) continue;
    findings.push({ category: 'email address', match: email, index: m.index ?? 0 });
  }
  return findings;
}

// ---------------------------------------------------------------- street addresses

const STREET_TYPES =
  'Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Terrace|Ter|Place|Pl|Circle|Cir|Parkway|Pkwy|Highway|Hwy|Trail|Trl';
const US_STATES =
  'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';

const ADDRESS_PATTERNS: RegExp[] = [
  // 1234 NW Example Street, 12 Oak Ln.
  new RegExp(
    String.raw`\b\d{1,6}\s+(?:[NSEW]{1,2}\.?\s+)?(?:\d{1,3}(?:st|nd|rd|th)\s+|[A-Z][a-z]+\s+){1,3}(?:${STREET_TYPES})\b\.?`,
    'g',
  ),
  // P.O. Box 12, Apt 4B, Suite 210, Unit 3
  /\b(?:P\.?\s?O\.?\s?Box|Apt\.?|Apartment|Suite|Unit)\s*#?\s*\d+[A-Z]?\b/g,
  // State + ZIP code: FL 32611, Florida 32611-1234
  new RegExp(String.raw`\b(?:${US_STATES}|Florida)\s+\d{5}(?:-\d{4})?\b`, 'g'),
];

export function findAddresses(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const pattern of ADDRESS_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      findings.push({ category: 'street address', match: m[0], index: m.index ?? 0 });
    }
  }
  return findings;
}

// ---------------------------------------------------------------- facts.md §15 terms

interface TermRule {
  category: string;
  pattern: RegExp;
}

/** Words that signal a facts.md §15 category, plus the retired framing from facts.md §5.1. */
export const SECTION_15_TERMS: readonly TermRule[] = [
  { category: '§15 grades', pattern: /\bGPA\b|\bgrade point average\b/gi },
  {
    category: '§15 immigration or work authorization',
    pattern:
      /\bimmigration\b|\bvisas?\b|\bwork[- ]authori[sz]ation\b|\bH-?1B\b|\bgreen card\b|\bpermanent resident\b|\bsponsorship\b|\bSEVIS\b|\bI-20\b/gi,
  },
  // Case-sensitive acronyms: "F-1", "OPT", "CPT", "EAD" as status names.
  {
    category: '§15 immigration or work authorization',
    pattern: /\bF-1\b|\bOPT\b|\bCPT\b|\bEAD\b/g,
  },
  {
    category: '§15 family members',
    pattern:
      /\bmy (?:wife|husband|spouse|partner|son|sons|daughter|daughters|kid|kids|child|children|baby|babies|toddler|parents|mother|father|mom|dad|in-laws)\b|(?:我(?:的)?(?:儿子|女儿|老婆|妻子|丈夫|孩子|宝宝|父母))/gi,
  },
  {
    category: '§15 health',
    pattern: /\bdiagnos(?:is|ed)\b|\bmedical (?:leave|condition|history)\b|\bpregnan(?:t|cy)\b/gi,
  },
  { category: '§15 compensation', pattern: /\bsalary\b|\bcompensation\b|\bstipend amount\b/gi },
  {
    category: '§15 job-search activity',
    pattern:
      /\bjob[- ](?:search|hunt|hunting|application|applications|offer|offers)\b|\boffer letter\b|\bon the (?:academic )?job market\b|\binterview(?:s|ed|ing)? (?:with|at) [A-Z]/gi,
  },
  {
    category: '§15 location or availability',
    pattern:
      /\brelocat(?:e|ion|ing)\b|\bwilling to (?:move|relocate)\b|\bavailable (?:to start|starting|from)\b|\bstart date\b|\bnotice period\b/gi,
  },
  {
    category: '§15 participant data',
    pattern: /\bparticipant (?:ID|#)\s*:?\s*\w+|\bP\d{1,3}\s*[:：]\s*["“]/gi,
  },
  {
    category: '§15 citation counts',
    pattern: /\bcited by \d+|\b\d[\d,]* citations\b|\bh-index\b|\bi10-index\b/gi,
  },
  {
    category: 'retired framing (facts.md §5.1)',
    pattern: /\bdecision matrix\b|\b18% name-only\b|\bself-report missed 38%/gi,
  },
];

export function findSection15Terms(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const rule of SECTION_15_TERMS) {
    for (const m of text.matchAll(rule.pattern)) {
      findings.push({ category: rule.category, match: m[0], index: m.index ?? 0 });
    }
  }
  return findings;
}

/** True when a short piece of fetched text (a video title, say) is safe to show. */
export function isPublishableText(text: string): boolean {
  return (
    findSection15Terms(text).length === 0 &&
    findPhones(text).length === 0 &&
    findEmails(text).length === 0 &&
    findAddresses(text).length === 0
  );
}

// ---------------------------------------------------------------- image metadata

export interface ImageMetadataReport {
  hasExif: boolean;
  hasXmp: boolean;
  hasIptc: boolean;
  hasLocation: boolean;
  details: string[];
}

/** Find the GPS IFD pointer (tag 0x8825) in a raw EXIF block as returned by sharp. */
export function exifHasGps(exif: Uint8Array): boolean {
  const bytes = Buffer.from(exif);
  let offset = bytes.indexOf('Exif\0\0', 0, 'latin1');
  offset = offset === -1 ? 0 : offset + 6;
  if (bytes.length < offset + 8) return false;
  const order = bytes.toString('latin1', offset, offset + 2);
  const little = order === 'II';
  if (!little && order !== 'MM') return false;
  const u16 = (at: number) => (little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at));
  const u32 = (at: number) => (little ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at));
  const ifd0 = offset + u32(offset + 4);
  if (bytes.length < ifd0 + 2) return false;
  const count = u16(ifd0);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (bytes.length < entry + 12) return false;
    if (u16(entry) === 0x8825) {
      const gpsIfd = offset + u32(entry + 8);
      // A GPS IFD with at least one entry carries location data.
      return bytes.length >= gpsIfd + 2 && u16(gpsIfd) > 0;
    }
  }
  return false;
}

/** IPTC location datasets: 2:90 city, 2:92 sublocation, 2:95 province/state, 2:101 country. */
export function iptcHasLocation(iptc: Uint8Array): boolean {
  for (let i = 0; i + 2 < iptc.length; i++) {
    if (iptc[i] === 0x1c && iptc[i + 1] === 0x02 && [90, 92, 95, 100, 101].includes(iptc[i + 2]!)) {
      return true;
    }
  }
  return false;
}

export function xmpHasLocation(xmp: Uint8Array): boolean {
  return /GPS(?:Latitude|Longitude|Altitude)|photoshop:City|Iptc4xmpCore:Location/i.test(
    Buffer.from(xmp).toString('utf8'),
  );
}

export function describeImageMetadata(meta: {
  exif?: Uint8Array;
  xmp?: Uint8Array;
  iptc?: Uint8Array;
}): ImageMetadataReport {
  const report: ImageMetadataReport = {
    hasExif: Boolean(meta.exif?.length),
    hasXmp: Boolean(meta.xmp?.length),
    hasIptc: Boolean(meta.iptc?.length),
    hasLocation: false,
    details: [],
  };
  if (meta.exif?.length && exifHasGps(meta.exif)) report.details.push('EXIF GPS');
  if (meta.xmp?.length && xmpHasLocation(meta.xmp)) report.details.push('XMP location');
  if (meta.iptc?.length && iptcHasLocation(meta.iptc)) report.details.push('IPTC location');
  report.hasLocation = report.details.length > 0;
  return report;
}

/** Line number (1-based) of a character index. */
export function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Show enough of a match to find it without repeating the whole value in public CI logs. */
export function mask(match: string): string {
  return match.length <= 6 ? match : `${match.slice(0, 4)}…${match.slice(-2)}`;
}
