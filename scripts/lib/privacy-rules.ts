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
  // North American numbers: (352) 555-0123, (352)555-0123, 352-555-0123, 352/555-0123, +1 352.555.0123
  /(?<![\w.+/-])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|[2-9]\d{2}[\s./-])\d{3}[\s.-]\d{4}(?![\w-])/g,
  // International numbers with a leading plus, with or without separators: +44 7700 900123
  /(?<![\w+])\+[2-9]\d{0,2}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,8}){1,4}(?![\w-])/g,
  // E.164 written without separators: +12125550123
  /(?<![\w+])\+\d{10,15}(?!\d)/g,
  // Mainland China mobiles, plain or grouped 3-4-4, with an optional +86 / 0086 / (+86) prefix.
  /(?<![\d+.-])(?:(?:\+|00)86[\s-]?|\(\+86\)\s?)?1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}(?![\d-])/g,
  // Mainland China landlines: 010-12345678, 0571-8888888
  /(?<![\d-])0\d{2,3}-\d{7,8}(?![\d-])/g,
  // Telephone links.
  /\btel:[+\d][\d ().-]{5,}/gi,
  // Any long digit run labeled as a phone number.
  /(?:\bphone|\btel(?:ephone)?|\bcell|\bmobile|手机|电话|微信)\s*(?:number|no\.?)?\s*[:：]?\s*\+?\d[\d\s().-]{6,}\d/gi,
];

/** 555-0100 through 555-0199 are reserved for fiction in North America. */
function isFictionalPhone(match: string): boolean {
  return /555[\s.-]?01\d{2}$/.test(match.replace(/[^\d\s.-]/g, ''));
}

export function findPhones(text: string): Finding[] {
  const findings: Finding[] = [];
  const spans: Array<[number, number]> = [];
  for (const pattern of PHONE_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      // Several patterns can match the same number; report it once.
      if (isFictionalPhone(m[0]) || spans.some(([s, e]) => start < e && s < end)) continue;
      spans.push([start, end]);
      findings.push({ category: 'phone number', match: m[0], index: start });
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
  // Chinese street addresses: …路 1037 号, …街 12 号, and room numbers like 302 室
  /[\u4e00-\u9fa5]{1,12}(?:路|街|大道|巷|弄|胡同)\s?\d{1,5}\s?号|\d{1,5}\s?(?:号楼|栋|幢|单元)\s?\d{0,5}\s?室?/g,
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

const FAMILY_NOUNS =
  'wife|husband|spouse|partner|sons?|daughters?|kids?|child|children|bab(?:y|ies)|toddlers?|infants?|newborns?|parents|mother|father|mom|mum|dad|in-laws|family|boys?|girls?|twins|little ones?';

/** Words that signal a facts.md §15 category, plus the retired framing from facts.md §5.1. */
export const SECTION_15_TERMS: readonly TermRule[] = [
  { category: '§15 grades', pattern: /\bGPA\b|\bgrade point average\b/gi },
  {
    category: '§15 immigration or work authorization',
    pattern:
      /\bimmigration\b|\bvisas?\b|\bwork[- ]authori[sz]ation\b|\bH-?1B\b|\bgreen card\b|\bpermanent resident\b|\b(?:visa|employer|employment) sponsorship\b|\bSEVIS\b|\bI-20\b/gi,
  },
  // Case-sensitive acronyms: "F-1", "OPT", "CPT", "EAD" as status names.
  {
    category: '§15 immigration or work authorization',
    pattern: /\bF-1\b|\bOPT\b|\bCPT\b|\bEAD\b/g,
  },
  {
    // First-person possessives only: "their parents" is ordinary research language.
    category: '§15 family members',
    pattern: new RegExp(
      String.raw`\b(?:my|our)\s+(?:(?:little|older|younger|eldest|oldest|youngest|baby|toddler|teenage|\d+[- ]year[- ]old)\s+)?(?:${FAMILY_NOUNS})\b|我(?:的)?(?:儿子|女儿|老婆|妻子|丈夫|老公|孩子|宝宝|父母|闺女)|我家`,
      'gi',
    ),
  },
  {
    category: '§15 health',
    pattern: /\bdiagnos(?:is|ed)\b|\bmedical (?:leave|condition|history)\b|\bpregnan(?:t|cy)\b/gi,
  },
  {
    category: '§15 compensation',
    pattern:
      /\bsalary\b|\bcompensation (?:package|expectations?)\b|\bmy (?:pay|stipend|compensation)\b/gi,
  },
  {
    category: '§15 job-search activity',
    pattern:
      /\bjob[- ](?:search|hunt|hunting|application|applications|offer|offers)\b|\boffer letter\b|\bon the (?:academic )?job market\b/gi,
  },
  // Case-sensitive on purpose: "interviewed at Google", not "interviews with older adults".
  {
    category: '§15 job-search activity',
    pattern: /\b[Ii]nterview(?:s|ed|ing)? (?:with|at) [A-Z][\w&-]+/g,
  },
  {
    category: '§15 location or availability',
    pattern:
      /\b(?:willing|able|open|happy) to (?:move|relocate)\b|\brelocation (?:assistance|package|support)\b|\bavailable (?:to start|immediately|starting (?:in|on|from)|from (?:January|February|March|April|May|June|July|August|September|October|November|December|\d{4}))\b|\b(?:my|earliest|possible|preferred) start date\b|\bnotice period\b/gi,
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

/**
 * Stricter family rule for text fetched at build time (video titles, repository names and
 * descriptions). The channel is about family life (D54), so any mention of a child or partner
 * keeps a title off the site. Too broad for page text: "baby thermometer" is a real build.
 */
const FETCHED_FAMILY = new RegExp(
  String.raw`\b(?:my|our|his|her|their)\s+(?:\w+\s+)?(?:${FAMILY_NOUNS})\b|\b(?:sons?|daughters?|toddlers?|newborns?|infants?|twins|wife|husband|kids?|bab(?:y|ies)|child|children)\b|\b\d+[- ](?:year|yr|month)[- ]olds?\b|\blittle ones?\b|儿子|女儿|宝宝|孩子|老婆|老公|闺女|娃|老大|老二|我家`,
  'i',
);

export function findSection15Terms(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const rule of SECTION_15_TERMS) {
    for (const m of text.matchAll(rule.pattern)) {
      findings.push({ category: rule.category, match: m[0], index: m.index ?? 0 });
    }
  }
  return findings;
}

/** True when text passes every rule the build-output scan applies. */
export function isPublishableText(text: string): boolean {
  return (
    findSection15Terms(text).length === 0 &&
    findPhones(text).length === 0 &&
    findEmails(text).length === 0 &&
    findAddresses(text).length === 0
  );
}

/**
 * True when text fetched at build time (a video title, a repository name or description) may
 * appear on the site: it passes the build-output scan, so it can never fail a deploy, and it
 * names no family member (D54).
 */
export function isPublishableFetchedText(text: string): boolean {
  return isPublishableText(text) && !FETCHED_FAMILY.test(text);
}

// ---------------------------------------------------------------- image metadata

export interface ImageMetadataReport {
  hasExif: boolean;
  hasXmp: boolean;
  hasIptc: boolean;
  /** Any EXIF, XMP, IPTC, or a raw metadata profile stored in a PNG text chunk. */
  hasMetadata: boolean;
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
  comments?: Array<{ keyword: string; text: string }>;
}): ImageMetadataReport {
  // ImageMagick and others store EXIF/XMP/IPTC in PNG text chunks ("Raw profile type exif").
  const rawProfiles = (meta.comments ?? []).filter((c) =>
    /raw profile type (?:exif|xmp|iptc|app1|8bim)|^XML:com\.adobe\.xmp$/i.test(c.keyword),
  );
  const report: ImageMetadataReport = {
    hasExif: Boolean(meta.exif?.length),
    hasXmp: Boolean(meta.xmp?.length),
    hasIptc: Boolean(meta.iptc?.length),
    hasMetadata: false,
    hasLocation: false,
    details: [],
  };
  if (report.hasExif) report.details.push('EXIF');
  if (report.hasXmp) report.details.push('XMP');
  if (report.hasIptc) report.details.push('IPTC');
  if (rawProfiles.length) report.details.push('raw metadata profile in a PNG text chunk');
  report.hasMetadata = report.details.length > 0;
  const location: string[] = [];
  if (meta.exif?.length && exifHasGps(meta.exif)) location.push('EXIF GPS');
  if (meta.xmp?.length && xmpHasLocation(meta.xmp)) location.push('XMP location');
  if (meta.iptc?.length && iptcHasLocation(meta.iptc)) location.push('IPTC location');
  report.hasLocation = location.length > 0;
  if (report.hasLocation) report.details.unshift(...location);
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
  const flat = match.replace(/\s+/g, ' ').trim();
  return flat.length <= 6 ? flat : `${flat.slice(0, 4)}…${flat.slice(-2)}`;
}
