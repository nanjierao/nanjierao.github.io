// Pattern rules for `npm run check:privacy` (D39, D31) and the build-time filter on fetched
// text. Pure functions so Vitest can exercise them with obviously fictional samples
// (555-01xx phone numbers, example.com addresses).

export interface Finding {
  category: string;
  match: string;
  index: number;
}

// ---------------------------------------------------------------- phone numbers

// ASCII hyphen plus Unicode hyphens, dashes and minus: people paste numbers from word processors.
const DASH = String.raw`\-‐-―−`;
const SEP = String.raw`[\s.${DASH}]`;

interface PhoneRule {
  pattern: RegExp;
  /** Extra check on the match, to keep code and data from looking like phone numbers. */
  accept?: (match: string) => boolean;
}

const digitCount = (s: string) => s.replace(/\D/g, '').length;

const PHONE_RULES: PhoneRule[] = [
  {
    // North American: (352) 555-0123, (352)555-0123, 352-555-0123, 352/555-0123, +1 352.555.0123
    pattern: new RegExp(
      String.raw`(?<![\w.+/${DASH}])(?:\+?1${SEP}?)?(?:\(\d{3}\)\s?|[2-9]\d{2}[\s./${DASH}])\d{3}${SEP}\d{4}(?![\w${DASH}])`,
      'g',
    ),
  },
  {
    // International with a leading plus: +44 7700 900123, +86-13800138000, +33 1 23 45 67 89.
    // Not after ")" or "]" (minified code such as "(x)+6777216") or after "UTC"/"GMT".
    pattern: new RegExp(
      String.raw`(?<![\w+)\]])(?<!(?:UTC|GMT)\s?)\+[2-9]\d{0,2}[\s${DASH}]?\(?\d{1,4}\)?(?:[\s.${DASH}]?\d{2,8}){1,4}(?![\w${DASH}])`,
      'g',
    ),
    accept: (m) => digitCount(m) >= 8 && !/^\+\d{1,3}\./.test(m),
  },
  {
    // E.164 without separators: +12125550123
    pattern: /(?<![\w+)\]])\+\d{10,15}(?!\d)/g,
  },
  {
    // Mainland China mobiles, plain or grouped 3-4-4 with one kind of separator, with an
    // optional +86 / 0086 / (+86) prefix. Not inside URL paths or after a dot.
    pattern: new RegExp(
      String.raw`(?<![\d+./${DASH}])(?:(?:\+|00)86[\s${DASH}]?|\(\+86\)\s?)?1[3-9]\d([\s.${DASH}]?)\d{4}\1\d{4}(?![\d${DASH}])(?!\s*(?:bytes?|tokens?|parameters?|params|ms|seconds?|字节|个))`,
      'g',
    ),
    // Large round numbers (token counts, bytes) are not phone numbers.
    accept: (m) => !/0{6,}$/.test(m.replace(/\D/g, '')),
  },
  {
    // Mainland China landlines: 010-12345678, 0571-8888888, (010) 6275 1234
    pattern: new RegExp(
      String.raw`(?<![\d${DASH}])(?:0\d{2,3}[${DASH}]\d{7,8}|\(0\d{2,3}\)\s?\d{3,4}\s?\d{4})(?![\d${DASH}])`,
      'g',
    ),
  },
  {
    // Telephone links.
    pattern: /\btel:[+\d][\d ().-]{5,}/gi,
  },
  {
    // A number written after a phone label and a colon: "Cell: 352 555 0123", "手机：…".
    pattern: new RegExp(
      String.raw`(?:\bphone|\btel(?:ephone)?|\bcell|\bmobile|\bwhatsapp|手机|电话|微信)\s*(?:number|no\.?|号码|号)?\s*[:：]\s*\+?\d[\d\s().${DASH}]{5,}\d`,
      'gi',
    ),
    accept: (m) => {
      const value = m.replace(/^[^:：]*[:：]\s*/, '');
      return (
        digitCount(value) >= 7 &&
        !/^\d{4}\s*[-–]\s*\d{4}$/.test(value) && // a year range
        !/^\d+(?:\.\d+){2,}$/.test(value) // a dotted version number
      );
    },
  },
];

/** 555-0100 through 555-0199 are reserved for fiction in North America. */
function isFictionalPhone(match: string): boolean {
  return /555\D?01\d{2}$/.test(match.replace(/[^\d\s.-]/g, ''));
}

/**
 * Normalize compatibility characters (full-width digits and punctuation) so the rules see
 * "１３８" as "138". Line breaks are kept, so line numbers stay right.
 */
export function normalizeForScan(text: string): string {
  return text.normalize('NFKC');
}

export function findPhones(input: string): Finding[] {
  const text = normalizeForScan(input);
  const findings: Finding[] = [];
  const spans: Array<[number, number]> = [];
  for (const { pattern, accept } of PHONE_RULES) {
    for (const m of text.matchAll(pattern)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (isFictionalPhone(m[0]) || (accept && !accept(m[0]))) continue;
      // Several rules can match the same number; report it once.
      if (spans.some(([s, e]) => start < e && s < end)) continue;
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

export function findEmails(input: string, allowed: readonly string[] = []): Finding[] {
  const text = normalizeForScan(input);
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
  'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|Florida';

const ADDRESS_PATTERNS: RegExp[] = [
  // A house number (not a year) and a street: 1234 NW Example Street, 12 Oak Ln.
  new RegExp(
    String.raw`\b(?!(?:19|20)\d{2}\b)\d{1,6}\s+(?:[NSEW]{1,2}\.?\s+)?(?:\d{1,3}(?:st|nd|rd|th)\s+|[A-Z][a-z]+\s+){1,3}(?:${STREET_TYPES})\b\.?`,
    'g',
  ),
  // P.O. Box 12, Apt 4B; Suite and Unit only in an address line ("Suite 210, …").
  /\b(?:P\.?\s?O\.?\s?Box|Apt\.?|Apartment)\s*#?\s*\d+[A-Z]?\b|\b(?:Suite|Unit)\s*#?\s*\d+[A-Z]?(?=,)/g,
  // City, state and ZIP code: "Gainesville, FL 32601", ", Florida 32611-1234"
  new RegExp(String.raw`,\s*(?:${US_STATES})\s+\d{5}(?:-\d{4})?\b`, 'g'),
  // Chinese addresses need an address shape, not just "路" and "号": a city or district before
  // the road ("…市…区…路1037号"), an address label, or a building with a room number.
  /[一-龥]{1,10}(?:省|市|区|县|镇)[一-龥]{0,12}?(?:路|街|大道|巷|弄|胡同)\s?\d{1,5}\s?号|(?:地址|住址|家住|寄到|收货地址)\s*[:：]?\s*[^\n]{0,30}?\d{1,5}\s?号|\d{1,4}\s?(?:号楼|栋|幢)\s?(?:\d{1,3}\s?单元)?\s?\d{2,5}\s?室|\d{1,3}\s?单元\s?\d{2,5}\s?室/g,
];

export function findAddresses(input: string): Finding[] {
  const text = normalizeForScan(input);
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

// Family nouns for page text. "partner", "girls" and "boys" are left out: "our partner
// agency", "our Girls Who Code club".
const FAMILY_NOUNS =
  'wife|husband|spouse|sons?|daughters?|kids?|child|children|bab(?:y|ies)|toddlers?|infants?|newborns?|parents|mother|father|mom|mum|dad|in-laws|family|twins|little ones?';
// Words after a family noun that make it something else: "our baby thermometer".
const NOT_FAMILY_AFTER =
  'thermometers?|monitors?|agenc(?:y|ies)|organi[sz]ations?|schools?|hospitals?|labs?|sites?|institutions?|friendly|participants?|stud(?:y|ies)|users?|data|products?|projects?';

const FAMILY = 'family members';
const IMMIGRATION = 'immigration or work authorization';
const JOB_SEARCH = 'job-search activity';
const AVAILABILITY = 'location or availability';

/** Words that signal a facts.md §15 category, plus the retired framing from facts.md §5.1. */
export const SECTION_15_TERMS: readonly TermRule[] = [
  { category: '§15 grades', pattern: /\bGPA\b|\bgrade point average\b/gi },
  {
    category: `§15 ${IMMIGRATION}`,
    pattern:
      /\bimmigration\b|\bwork[- ]authori[sz]ation\b|\bH-?1B\b|\bgreen card\b|\bpermanent resident\b|\bSEVIS\b|\bI-20\b|\b(?:require[sd]?|need(?:s|ed)?|without)\s+(?:\w+\s+)?sponsorship\b|\b(?:visa|employer|employment|work) sponsorship\b/gi,
  },
  // Case-sensitive: "visa" and status names, but not the card network or ML acronyms
  // ("Payments go through Visa", "OPT-175B", "continued pre-training (CPT)").
  {
    category: `§15 ${IMMIGRATION}`,
    pattern:
      /\bvisas?\b|\b(?:[Ss]tudent|[Ww]ork|[Tt]ourist|H-?1B|F-1|J-1|O-1) [Vv]isa\b|\bVisa (?:status|application|interview|sponsorship|issues?|appointment)\b|\bF-1 (?:visa|status|student)\b|\bon (?:an |my )?F-1\b|\b(?:on|my|STEM|apply for|applied for) (?:OPT|CPT)\b|\b(?:OPT|CPT) (?:status|authorization|extension|application|period)\b|\bmy EAD\b|\bEAD card\b/g,
  },
  {
    // First-person possessives only: "their parents" is ordinary research language.
    category: `§15 ${FAMILY}`,
    pattern: new RegExp(
      String.raw`\b(?:my|our)\s+(?:(?:little|older|younger|eldest|oldest|youngest|baby|toddler|teenage|first|second|third|new|\d+[- ]year[- ]old)\s+)?(?:${FAMILY_NOUNS})\b(?![- ](?:${NOT_FAMILY_AFTER})\b)|我(?:的)?(?:儿子|女儿|老婆|妻子|丈夫|老公|孩子|宝宝|父母|闺女)|我(?:们)?家(?!乡)`,
      'gi',
    ),
  },
  {
    category: '§15 health',
    pattern:
      /\bdiagnosed with\b|\b(?:my|I was|I've been|I have been) diagnos(?:ed|is)\b|\bmedical (?:leave|condition|history)\b|\bpregnan(?:t|cy)\b/gi,
  },
  {
    category: '§15 compensation',
    pattern:
      /\bsalary\b|\b(?:expected|desired|current) (?:compensation|pay)\b|\bcompensation\s*[:：]|\bcompensation (?:package|expectations?)\b|\bmy (?:pay|stipend|compensation)\b/gi,
  },
  {
    category: `§15 ${JOB_SEARCH}`,
    pattern:
      /\bjob[- ](?:search|hunt|hunting|application|applications|offer|offers)\b|\boffer letter\b|\bon the (?:academic )?job market\b|\b(?:job|on-?site|phone|campus|final[- ]round|faculty|screening) interviews?\b|\bsearch committee\b/gi,
  },
  // Case-sensitive on purpose: "interviewed at Google", not "interviews with older adults".
  {
    category: `§15 ${JOB_SEARCH}`,
    pattern: /\b[Ii]nterview(?:ed|ing)? (?:for|at) (?:the |a |an )?[A-Z]/g,
  },
  {
    category: `§15 ${AVAILABILITY}`,
    pattern:
      /\b(?:I am|I'm|I will be|I'll be|I'd be|I would be)\s+(?:\w+\s+)?(?:available|relocating)\b|\bI (?:can|could|will|would|plan to|intend to)\s+relocate\b|\b(?:willing|able|open|happy) to (?:move|relocate)\b|\brelocation (?:assistance|package|support)\b|\bavailab(?:le to start|ility\s*[:：])|\b(?:my|earliest|possible|preferred|expected) start date\b|\bstart date\s*[:：]|\bnotice period\b/gi,
  },
  // A CV-style fragment: "Available from January 2027" (capital A; "the data are available
  // from 2024" is ordinary text).
  {
    category: `§15 ${AVAILABILITY}`,
    pattern:
      /\bAvailable (?:from|starting)(?: in| on)? (?:January|February|March|April|May|June|July|August|September|October|November|December|Spring|Summer|Fall|Autumn|Winter|\d{4})\b/g,
  },
  {
    category: '§15 participant data',
    pattern: /\b[Pp]articipant (?:ID\b|#)\s*:?\s*\w+|\bP\d{1,3}\s*[:：]\s*["“]/g,
  },
  {
    category: '§15 citation counts',
    pattern: /\bcited by \d+|\bcitations?\s*[:：]\s*\d|\bh-index\b|\bi10-index\b/gi,
  },
  {
    category: 'retired framing (facts.md §5.1)',
    pattern: /\bdecision matrix\b|\b18% name-only\b|\bself-report missed 38%/gi,
  },
];

/**
 * Stricter family rule for fetched YouTube titles only (D54): the channel is about family life,
 * so any mention of a child, partner or relative keeps a title off the site. Far too broad for
 * page text or repository names ("baby thermometer", "urban digital twins").
 */
const TITLE_FAMILY_NOUNS = `${FAMILY_NOUNS}|partner|boys?|girls?|kiddos?|preschoolers?|firstborn|eldest|youngest|oldest|teen(?:ager)?s?|siblings?|sisters?|brothers?|grand(?:ma|pa|mother|father|parents?|kids?|children)|nephews?|nieces?|little (?:guy|girl|boy|man|lady)`;
const TITLE_FAMILY = new RegExp(
  String.raw`\b(?:my|our|his|her|their)\s+(?:\w+\s+)?(?:${TITLE_FAMILY_NOUNS})\b|\b(?:sons?|daughters?|toddlers?|newborns?|infants?|twins|wife|husband|kids?|kiddos?|bab(?:y|ies)|child|children|preschoolers?|firstborn|grand(?:ma|pa|mother|father|parents?)|mom|mommy|mum|dad|daddy|kindergarten|daycare|preschool|(?:big|little) (?:sister|brother))\b|\b\d+[\s-]?(?:yo|y\/o|yrs?|years?|mos?|months?)(?:[- ]olds?)?\b|\blittle ones?\b|儿子|女儿|宝宝|宝贝|孩子|小孩|小朋友|儿童|亲子|老婆|老公|媳妇|闺女|娃|老大|老二|大宝|二宝|小宝|爸爸|妈妈|老爸|老妈|姐姐|弟弟|哥哥|妹妹|我家|我们家|全家|一家`,
  'i',
);

export function findSection15Terms(input: string, options: { code?: boolean } = {}): Finding[] {
  const text = normalizeForScan(input);
  const findings: Finding[] = [];
  for (const rule of SECTION_15_TERMS) {
    // The quotation shape (P7: "…") is for prose; code has object keys like that.
    if (options.code && rule.category === '§15 participant data') continue;
    for (const m of text.matchAll(rule.pattern)) {
      findings.push({ category: rule.category, match: m[0], index: m.index ?? 0 });
    }
  }
  return findings;
}

/**
 * True when text passes every rule the build-output scan applies. Fetched repository names and
 * descriptions use this, so they can never fail a deploy.
 */
export function isPublishableText(text: string): boolean {
  return (
    findSection15Terms(text).length === 0 &&
    findPhones(text).length === 0 &&
    findEmails(text).length === 0 &&
    findAddresses(text).length === 0
  );
}

/** For fetched YouTube titles (D54): the page-text rules plus the strict family rule. */
export function isPublishableVideoTitle(text: string): boolean {
  return isPublishableText(text) && !TITLE_FAMILY.test(normalizeForScan(text));
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

/**
 * Blank out license and attribution comments in JS/CSS so a library author's address in a
 * bundled or vendored header isn't reported: block comments that are legal comments or mention
 * a copyright, author or license, and // lines that do. Lengths and line breaks are kept, so
 * positions stay right.
 */
export function stripLicenseComments(code: string): string {
  const blank = (comment: string) => comment.replace(/[^\n]/g, ' ');
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      /^\/\*!|@license|@preserve|@author|copyright|licen[cs]e/i.test(comment)
        ? blank(comment)
        : comment,
    )
    .replace(/^[ \t]*\/\/.*(?:copyright|@author|licen[cs]e).*$/gim, blank);
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
