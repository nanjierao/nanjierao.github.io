// Pattern rules for `npm run check:privacy` (D39, D31) and the build-time filter on fetched
// text. Pure functions so Vitest can exercise them with obviously fictional samples
// (555-01xx phone numbers, example.com addresses). tests/unit/privacy-corpus.ts holds the labeled
// sentences (both directions) that every rule below is measured against.
//
// How the rules are built (fourth review, October 2026):
// - Phone numbers, email and street addresses stay high-recall: they are checked in every file.
// - facts.md §15 terms are precision first: a finding should be about the site owner. A rule needs
//   a first-person anchor (I, I'm, my; 我, 我的), a CV-style label at the start of a line, the
//   owner's name with a possessive, or a status token with no other meaning (H-1B, OPT EAD,
//   h-index). Unambiguous immigration words count anywhere, because the site doesn't discuss
//   immigration at all.
// - Chinese has no word boundaries, so each Chinese term lists the compounds it must not match.

export interface Finding {
  category: string;
  match: string;
  index: number;
}

// ---------------------------------------------------------------- normalization

/**
 * Turn look-alike characters into the ASCII the rules are written for, so "I’m", "I&#39;m",
 * "H‑1B" (non-breaking hyphen), "１３８" and "jane&#64;uni.edu" match like their plain forms.
 * NFKC handles full-width digits and punctuation; then curly and modifier apostrophes become ',
 * U+2010/U+2011 hyphens become -, and the HTML/URL escapes for ', @ and a non-breaking space are
 * decoded (&amp; is not, so nothing decodes twice). Line breaks are kept, so line numbers stay
 * right. Idempotent: scripts/check-privacy.ts normalizes before calling the rules, and the rules
 * normalize again, so match positions must not drift.
 */
export function normalizeForScan(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u2010\u2011]/g, '-')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&#0*64;|&#x0*40;|&commat;|%40/gi, '@')
    .replace(/&nbsp;/gi, ' ');
}

// ---------------------------------------------------------------- shared pieces

const MONTH_OR_SEASON = String.raw`(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|Spring|Summer|Fall|Autumn|Winter)\b`;

/**
 * Where a CV-style label sits: the start of a line, or right after an HTML tag, a quote or a
 * Markdown table pipe ("<li>Availability: …", "| Salary: |", "note: 'Compensation: …'"), then an
 * optional list bullet. Needs the m flag.
 */
const LABEL_START = String.raw`(?:^|(?<=[>"'\`|]))[ \t]*(?:[-*•][ \t]*)?`;

/** One Chinese clause. normalizeForScan has already turned ，；！？（） into ASCII. */
const ZH_CLAUSE = String.raw`[^,。!?;\n]`;
/**
 * 我 as the speaker: not 自我 (self-), not the institutional 我国/我校/我院/我系, and not an
 * opinion or a research topic (我觉得, 我认为, 我研究).
 */
const ZH_I = String.raw`(?<!自)我(?![国校院系司方军省市])(?!们?(?:觉得|认为|听说|看到|发现|猜|相信|建议|研究))`;
/** A Chinese term standing as its own clause: a title, a tag or a CV field ("求职", "年薪30万"). */
const ZH_ALONE_BEFORE = String.raw`(?:^|(?<=[,。!?;:\n>|"'(“「]))[ \t]*(?:[-*•][ \t]*)?`;
const ZH_ALONE_AFTER = String.raw`[ \t]*(?=$|[,。!?;\n<|"')”」])`;

const OWNER_POSSESSIVE = String.raw`\b(?:Jimmy|Nanjie|Rao)'s\s+(?:[\w-]+\s+)?`;

/**
 * The text already reported, so several patterns matching the same place report it once. Kept
 * spans never overlap and are sorted, so a lookup is a binary search and a file with thousands of
 * findings stays fast. Spans added while one pattern runs are merged in by `commit()`.
 */
class ReportedSpans {
  private starts: number[] = [];
  private ends: number[] = [];
  private pending: Array<[number, number]> = [];

  overlaps(start: number, end: number): boolean {
    let lo = 0;
    let hi = this.starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.starts[mid]! < end) lo = mid + 1;
      else hi = mid;
    }
    // Disjoint and sorted: only the last span starting before `end` can reach past `start`.
    return lo > 0 && this.ends[lo - 1]! > start;
  }

  add(start: number, end: number): void {
    this.pending.push([start, end]);
  }

  commit(): void {
    if (this.pending.length === 0) return;
    const starts: number[] = [];
    const ends: number[] = [];
    let i = 0;
    for (const [start, end] of this.pending) {
      while (i < this.starts.length && this.starts[i]! < start) {
        starts.push(this.starts[i]!);
        ends.push(this.ends[i]!);
        i++;
      }
      starts.push(start);
      ends.push(end);
    }
    for (; i < this.starts.length; i++) {
      starts.push(this.starts[i]!);
      ends.push(this.ends[i]!);
    }
    this.starts = starts;
    this.ends = ends;
    this.pending = [];
  }
}

/** Run patterns over normalized text; report each place once per category. */
function collect(text: string, patterns: Array<{ category: string; pattern: RegExp }>): Finding[] {
  const findings: Finding[] = [];
  const reported = new Map<string, ReportedSpans>();
  for (const { category, pattern } of patterns) {
    let spans = reported.get(category);
    if (!spans) reported.set(category, (spans = new ReportedSpans()));
    for (const m of text.matchAll(pattern)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (spans.overlaps(start, end)) continue;
      spans.add(start, end);
      findings.push({ category, match: m[0], index: start });
    }
    spans.commit();
  }
  return findings;
}

// ---------------------------------------------------------------- phone numbers

// Separators inside a number: ASCII hyphen plus Unicode hyphens, dashes (U+2010 to U+2015) and
// minus, because people paste numbers from word processors.
const DASH = String.raw`\-\u2010-\u2015\u2212`;
// Next to a number only hyphens and minus join it to something else ("ID-138…", "−212…"). An en
// or em dash is punctuation: "Phone—352-…", "联系我——138…".
const HYPHEN = String.raw`\-\u2010\u2011\u2212`;
// After a number: not a letter, digit or hyphen, and not a decimal part ("312.512 1024.75").
const END = String.raw`(?![\w${HYPHEN}]|\.\d)`;
/** Words after a number that make it a count, a size or a duration ("212 145 1024 tokens"). */
const UNIT_AFTER = String.raw`(?!\s*(?:(?i:bytes?|tokens?|parameters?|params|ms|seconds?|steps?|samples?|records?|rows?|lines?|words?|items?|points?|pixels?|px|visits?|posts?|downloads?|views?|people|nuclei|cells?|requests?)\b|[元种维个台层块次条张位字行页份人名项篇帧像参词万亿]|分辨率))`;
/** Image, model and network sizes that come in runs ("256 512 1024", "512 768 1024"). */
const ML_SIZES = new Set([
  '128',
  '256',
  '512',
  '768',
  '1024',
  '1536',
  '2048',
  '3072',
  '4096',
  '8192',
]);

interface PhoneRule {
  pattern: RegExp;
  category?: string;
  /** Extra check on the match and its surroundings, to keep code and data out. */
  accept?: (match: RegExpMatchArray, text: string) => boolean;
}

const digitsOf = (s: string) => s.replace(/\D/g, '');
const isPowerOfTwo = (digits: string) => {
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 1 && Number.isInteger(Math.log2(n));
};
/** SVG geometry ("d", "points", "viewBox", "transform") is long runs of plain numbers. */
const IN_SVG_ATTRIBUTE =
  /\b(?:d|points|viewBox|transform|stroke-dash\w*|values|keyTimes|keySplines|gradientTransform)\s*=\s*["'][^"'<>]*$/;

function before(m: RegExpMatchArray, text: string, length: number): string {
  const start = m.index ?? 0;
  return text.slice(Math.max(0, start - length), start);
}
function after(m: RegExpMatchArray, text: string, length: number): string {
  const end = (m.index ?? 0) + m[0].length;
  return text.slice(end, end + length);
}
/** Inside SVG geometry, on the same line. */
const inSvgGeometry = (m: RegExpMatchArray, text: string) =>
  IN_SVG_ATTRIBUTE.test(before(m, text, 300).split('\n').pop() ?? '');
/** One piece of a longer run of plain numbers (a matrix, a polyline, a table row). */
const inNumberRun = (m: RegExpMatchArray, text: string) =>
  /\d[\s,]{1,3}$/.test(before(m, text, 4)) || /^[\s,]{1,3}\d/.test(after(m, text, 4));

const PHONE_RULES: PhoneRule[] = [
  {
    // North American with a parenthesized area code: (352) 555-0123, (352)-555-0123,
    // (352)5550123, +1 (352) 555-0123. Not "f(100)-200-3000" (no area code starts with 0 or 1).
    pattern: new RegExp(
      String.raw`(?<![\w.+/${HYPHEN}])(?:\+?1[\s.${DASH}]?)?\([2-9]\d{2}\)\s{0,2}[${DASH}]?\s{0,2}\d{3}[\s.${DASH}]?\d{4}${END}${UNIT_AFTER}`,
      'g',
    ),
  },
  {
    // North American with separators: 352-555-0123, 352.555.0123, 352/555-0123, 352 – 555 – 0123,
    // +1 352 555 0123, 1-352-555-0123. A leading "1" counts only before a space or hyphen
    // ("1.677.697.6962" is SVG path data). Left out: runs of sizes (256 512 1024), a page range
    // plus a year (312–318 2024), numbers after "pp."/"ID", inside SVG geometry, and — with
    // spaces only — numbers that are part of a longer run of numbers.
    pattern: new RegExp(
      String.raw`(?<![\w.+/${HYPHEN}])(?<!\b(?:pp?\.|[Pp]ages?|ID|Id|ISBN|ORCID|PIN|[Pp]asscode)[:#]?\s{1,2})(\+1[\s.${DASH}]?|1[\s${DASH}])?[2-9]\d{2}([\s./${DASH}]|\s{0,2}[${DASH}]\s{0,2})\d{3}([\s.${DASH}]|\s{0,2}[${DASH}]\s{0,2})\d{4}${END}${UNIT_AFTER}`,
      'g',
    ),
    accept: (m, text) => {
      const [, prefix, sep1 = '', sep2 = ''] = m;
      const groups = m[0].replace(/^\+?1(?=\D)/, '').match(/\d+/g) ?? [];
      if (groups.filter((g) => ML_SIZES.has(g)).length >= 2) return false;
      if (inSvgGeometry(m, text)) return false;
      // A page range and a year: "312–318 2024".
      if (
        /[\u2013\u2014-]/.test(sep1) &&
        /^\s+$/.test(sep2) &&
        /^(?:19|20)\d{2}$/.test(groups[2] ?? '')
      )
        return false;
      const spacesOnly = !prefix && /^\s+$/.test(sep1) && /^\s+$/.test(sep2);
      return !(spacesOnly && inNumberRun(m, text));
    },
  },
  {
    // International with a leading plus and at least one separator: +44 7700 900123,
    // +86-13800138000, +33 1 23 45 67 89. Not after ")", "]", "=", "[" or "," (minified code such
    // as "(x)+6777216" or "x=[+23456789,…"), not after "UTC"/"GMT", and not a count ("+23456−7890
    // lines"). Each digit group is matched atomically (?=(…))\1, so long digit runs don't backtrack.
    pattern: new RegExp(
      String.raw`(?<![\w+)\]=\[,])(?<!(?:UTC|GMT)\s?)\+[2-9]\d{0,2}[\s${DASH}]?\(?\d{1,4}\)?(?:[\s.${DASH}]?(?=(\d{2,8}))\1){1,4}${END}${UNIT_AFTER}`,
      'g',
    ),
    accept: (m) =>
      digitsOf(m[0]).length >= 8 &&
      !/^\+\d{1,3}\./.test(m[0]) &&
      /[\s().\-\u2010-\u2015\u2212]/.test(m[0].slice(1)),
  },
  {
    // E.164 without separators: +12125550123, +1 2125550123. Not string concatenation ("?t="+1234567890) or an
    // array of numbers ("[+23456789,+1380013800]").
    pattern: new RegExp(
      String.raw`(?<![\w+)\]=,\[])(?<!=["'])\+(?:\d{10,15}|1[\s.${DASH}]\d{10})(?!\d)${UNIT_AFTER}`,
      'g',
    ),
  },
  {
    // Mainland China mobiles, plain or grouped 3-4-4 with one kind of separator, with an optional
    // +86 / 0086 / (+86) prefix. "Tel.138…" and "手机/138…" count. Left out: digits next to letters
    // (hashes, IDs), after a dot that follows no letter ("-.189.4067.4067" in a minified SVG path,
    // "0.13800138000") or in a URL path, after an ID key ("id":…, Build …),
    // after a count word (参数量是, 一共), before a unit (bytes, tokens, 条, 个), round numbers,
    // exact powers of two (byte counts), SVG geometry, and — with spaces only — a piece of a
    // longer run of numbers ("150 1200 1300" in a polyline).
    pattern: new RegExp(
      String.raw`(?<![\dA-Za-z+_${HYPHEN}])(?<![^A-Za-z]\.)(?<![\w.~%${HYPHEN}]/)(?<!(?:id|ID|Id|run|Run|build|Build|issue|answer|question)["']?\s{0,2}[:=#]?\s{0,2}["']?)(?<!(?:参数量|数量|总数|总量|一共|共计|总共|大约|约|count|total)\s{0,2}(?:是|为|有|:|=)?\s{0,2})(?:(?:\+|00)86[\s${DASH}]?|\(\+86\)\s?)?1[3-9]\d([\s.${DASH}]?)\d{4}\1\d{4}(?![\dA-Za-z${HYPHEN}]|\.\d)${UNIT_AFTER}`,
      'g',
    ),
    accept: (m, text) => {
      const digits = digitsOf(m[0]).slice(-11);
      if (/0{6,}$/.test(digits) || isPowerOfTwo(digits) || inSvgGeometry(m, text)) return false;
      return !(/^\s+$/.test(m[1] ?? '') && inNumberRun(m, text));
    },
  },
  {
    // Mainland China landlines: 010-12345678, 0571-8888888, (010) 6275 1234, 010 6275 1234,
    // "Tel.010-…". Not after a letter, digit or hyphen ("ID0571-…", "x-010-…") or a decimal
    // ("v2.0571-…"), and not a date ("0571-20261027").
    pattern: new RegExp(
      String.raw`(?<![\w${HYPHEN}])(?<!\d\.)(?:0\d{2,3}[${DASH}]\d{7,8}|\(0\d{2,3}\)\s?\d{3,4}\s?\d{4}|0[1-9]\d{1,2}[\s${DASH}]\d{3,4}[\s${DASH}]\d{4})${END}${UNIT_AFTER}`,
      'g',
    ),
    accept: (m) =>
      !/[\s\-\u2010-\u2015\u2212](?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(
        m[0],
      ),
  },
  {
    // Telephone links.
    pattern: /\btel:[+\d][\d ().-]{5,}/gi,
  },
  {
    // A number after a phone label: "Cell: 352 555 0123", "Phone 3525550123", "手机：…". Not a
    // year range ("Mobile: 2019—2024"), a date, a version, a thousands-grouped count ("Cell: 12
    // 345 678 nuclei"), a journal volume ("Cell 179 (5) 1037–1050"), a conference ("Mobile 2025
    // (12–16 Sept.)") or a resolution.
    pattern: new RegExp(
      String.raw`(?:\bphone|\btel(?:ephone)?|\bcell|\bmobile|\bwhatsapp|手机|电话|微信)\s*(?:number|no\.?|#|号码|号)?\s*[:：]?\s*\+?\d[\d\s().${DASH}]{5,}\d(?!\d)${UNIT_AFTER}`,
      'gi',
    ),
    accept: (m) => {
      const value = m[0].replace(/^\D*/, '');
      return (
        digitsOf(value).length >= 7 &&
        !new RegExp(String.raw`^\d{4}\s*[${DASH}~]\s*\d{2,4}\b`).test(value) &&
        !/^\d{4}-\d{2}-\d{2}/.test(value) &&
        !/^\d+(?:\.\d+){2,}$/.test(value) &&
        !/^\d{1,3}(?:[ ,]\d{3})+$/.test(value) &&
        !/^(?:19|20)\d{2}\s*\(/.test(value) &&
        !(/^\d/.test(value) && /\d\s?\(\d{1,3}\)/.test(value))
      );
    },
  },
  // Messaging handles work like phone numbers: a WeChat ID or QQ number is a way to reach a
  // person. Only with a first-person or label cue ("加我微信 …", "微信号：…", "我的QQ：…"); not
  // "微信支付", "加我微信公众号", "WeChat: available on request" or "微信：8.0.50" (a version).
  {
    category: 'contact handle',
    pattern:
      /(?:加(?:我的?)?|我的)(?:微信|[vV]信)号?\s*(?:[:：]|是|号是)?\s*[A-Za-z][-_A-Za-z0-9]{5,19}(?![\w-])/g,
  },
  {
    category: 'contact handle',
    pattern:
      /(?:微信号|微信\s*ID|微信id|(?<![\w$.{,])(?:vx|VX|wx|WX))\s*(?:[:：]|是)\s*[A-Za-z][-_A-Za-z0-9]{5,19}(?![\w-])/g,
  },
  {
    category: 'contact handle',
    pattern:
      /(?:微信|WeChat)\s*[:：]\s*[A-Za-z](?=[-_A-Za-z0-9]{5,19}(?![\w-]))[A-Za-z]*[\d_-][-_A-Za-z0-9]*/g,
  },
  {
    category: 'contact handle',
    pattern: /(?:我的|加我|个人)\s*QQ\s*号?\s*(?:[:：]|是)?\s*\d{5,11}(?!\d)/g,
  },
];

/** 555-0100 through 555-0199 are reserved for fiction in North America. */
function isFictionalPhone(match: string): boolean {
  return /555\D?01\d{2}$/.test(match.replace(/[^\d\s.-]/g, ''));
}

export function findPhones(input: string): Finding[] {
  const text = normalizeForScan(input);
  const findings: Finding[] = [];
  // Several rules can match the same number; report it once.
  const spans = new ReportedSpans();
  for (const { pattern, accept, category = 'phone number' } of PHONE_RULES) {
    for (const m of text.matchAll(pattern)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (isFictionalPhone(m[0]) || (accept && !accept(m, text))) continue;
      if (spans.overlaps(start, end)) continue;
      spans.add(start, end);
      findings.push({ category, match: m[0], index: start });
    }
    spans.commit();
  }
  return findings;
}

// ---------------------------------------------------------------- email addresses

// The start is anchored (no local-part character before it), so long runs of letters or digits
// are scanned once, not once per position. The end refuses "_" and digits, so hashed asset names
// ("figure@2x.fiajFXIo_Z1PDxhF.webp") aren't addresses.
const EMAIL =
  /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9_-])/g;
// Addresses written to dodge spam bots: "jane [at] uni [dot] edu", "jane(at)uni.edu",
// "jane{at}uni.edu", "jane AT uni DOT edu". The bare " at … dot " form needs the word "dot", so
// "I worked at Google.com" and "look at the data dot plot" don't count.
const AT_WORD = String.raw`\s*(?:\[\s*(?:at|AT|@)\s*\]|\(\s*(?:at|AT|@)\s*\)|\{\s*(?:at|AT|@)\s*\}|<\s*(?:at|AT)\s*>)\s*`;
const DOT_WORD = String.raw`(?:\s*(?:\[\s*(?:dot|DOT|\.)\s*\]|\(\s*(?:dot|DOT|\.)\s*\)|\{\s*(?:dot|DOT|\.)\s*\})\s*|\s+(?:dot|DOT)\s+)`;
const OBFUSCATED_TLD = String.raw`(?:edu|com|org|net|gov|io|me|cn|uk|ca|de|jp|info|dev|ai|us|EDU|COM|ORG|NET|GOV|IO|CN)`;
const OBFUSCATED_EMAIL = new RegExp(
  String.raw`(?<![\w.%+-])[A-Za-z0-9._%+-]+(?:${AT_WORD}[A-Za-z0-9-]+(?:(?:${DOT_WORD}|\.)[A-Za-z0-9-]+)*?(?:${DOT_WORD}|\.)|\s+(?:at|AT)\s+[A-Za-z0-9-]+(?:${DOT_WORD}[A-Za-z0-9-]+)*?${DOT_WORD})${OBFUSCATED_TLD}\b`,
  'g',
);
const FILE_LIKE_TLD =
  /\.(?:png|jpe?g|gif|svg|webp|avif|ico|js|mjs|cjs|ts|tsx|css|json|md|html?|woff2?|mp4|webm|mov|m4v|vtt|glb|gltf|wasm|task|pdf|var)$/i;
/** Retina asset names: logo@2x.png, figure@1.5x.webp. */
const RETINA = /@\d+(?:\.\d+)?x\./i;
const RESERVED_DOMAINS =
  /@(?:[\w-]+\.)*(?:example\.(?:com|org|net)|[\w-]+\.(?:test|example|invalid))$/i;
const ALWAYS_ALLOWED = [
  /@users\.noreply\.github\.com$/i,
  /^noreply@anthropic\.com$/i,
  // git over SSH: git clone git@github.com:owner/repo.git
  /^git@(?:github\.com|gitlab\.com|bitbucket\.org|gitee\.com|codeberg\.org|hf\.co)$/i,
];

function deobfuscate(match: string): string {
  return match
    .replace(new RegExp(`(?:${AT_WORD}|\\s+(?:at|AT)\\s+)`), '@')
    .replace(new RegExp(DOT_WORD, 'g'), '.')
    .toLowerCase();
}

export function findEmails(input: string, allowed: readonly string[] = []): Finding[] {
  const text = normalizeForScan(input);
  const allow = new Set(allowed.map((e) => e.toLowerCase()));
  const findings: Finding[] = [];
  const spans = new ReportedSpans();
  const consider = (match: string, address: string, index: number) => {
    if (FILE_LIKE_TLD.test(address) || RETINA.test(address)) return; // e.g. logo@2x.png
    if (RESERVED_DOMAINS.test(address)) return;
    if (ALWAYS_ALLOWED.some((re) => re.test(address))) return;
    if (allow.has(address.toLowerCase())) return;
    if (spans.overlaps(index, index + match.length)) return;
    spans.add(index, index + match.length);
    findings.push({ category: 'email address', match, index });
  };
  for (const m of text.matchAll(EMAIL)) consider(m[0], m[0], m.index ?? 0);
  spans.commit();
  for (const m of text.matchAll(OBFUSCATED_EMAIL)) consider(m[0], deobfuscate(m[0]), m.index ?? 0);
  return findings;
}

// ---------------------------------------------------------------- street addresses

const STREET_TYPES =
  'Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Terrace|Ter|Place|Pl|Circle|Cir|Parkway|Pkwy|Highway|Hwy|Trail|Trl';
// "St" before a saint's name and "Dr" before a capitalized surname are not street types:
// "Minneapolis St. Paul", "Instructor Dr. Wang".
const STREET_TYPE = STREET_TYPES.replace(
  /\bSt\b/,
  String.raw`St(?!\.?\s+(?:Louis|Paul|Augustine|Petersburg|Pete|Johns?|Cloud|Joseph|Charles|George|Mary|Lucia|Kitts|Thomas|Andrews|Albans|Gallen|Martin|Helena|Kilda|Vincent)\b)`,
).replace(/\bDr\b/, String.raw`Dr(?!\.?\s+[A-Z][a-z])`);
// Codes that are also everyday words or abbreviations ("Study ID 20231", "Status OK 20000") need
// a comma before them to count as a state.
const WORD_LIKE_STATES = 'ID|IN|OR|ME|OK|HI|DE';
// Florida (FL, Florida, Fla.) is handled apart, because its ZIP codes are known: 32xxx–34xxx.
const OTHER_STATES =
  'AL|AK|AZ|AR|CA|CO|CT|GA|IL|IA|KS|KY|LA|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';
const ALL_STATES = `${OTHER_STATES}|${WORD_LIKE_STATES}|FL|Florida|Fla`;
const DIRECTIONAL = String.raw`(?:[NS]\.?\s?[EW]\.?|[NSEW]\.?|North|South|East|West|Northeast|Northwest|Southeast|Southwest)`;
const SHORT_DIRECTIONAL = String.raw`(?:[NS]\.?\s?[EW]\.?|[NSEW]\.?)`;
const ORDINAL = String.raw`\d{1,3}(?:st|nd|rd|th)`;
const YEAR = String.raw`(?:19|20)\d{2}`;
/** Words before a number that make it a figure, unit, team, room or course number. */
const NOT_HOUSE_BEFORE = String.raw`(?<!\b(?:Table|Tables|Figure|Figures|Fig\.|Week|Weeks|Chapter|Ch\.|Session|Sessions|Unit|Units|Lesson|Step|Steps|Top|Team|Teams|Grade|Season|Episode|Part|Section|Sec\.|Phase|Study|Studies|Room|Rm\.|Level|Round|Day|Days|Module|Lab|Slide|Slides|Page|Pages|Exercise|Problem|Question|Task|Tasks|Log|Saved|Group|Groups|No\.|Number|Version|Class|Period|Track|Stage|Wave|Cohort|Batch|Floor|Gate|Hall|Box|Rank|Ranked|Sprint|Iteration|Image|Video|Videos|Clip|Scene|Article|Item|Line|Volume|Vol\.|Issue|Hackathon|Won|won|ID|Course|Courses|Term|Year|Years)\s)(?<!\b[A-Z]{2,4}\s)`;
// A house number: up to six digits, but a year-like number (2015) only before a short directional
// or an ordinal street ("2015 SW 16th Ave"), so "Since 2016 Google Drive", "1969 Sesame Street"
// and "Hackathon 2024 2nd Place" stay out.
const HOUSE_NUMBER = String.raw`${NOT_HOUSE_BEFORE}(?:(?!${YEAR}\b)\d{1,6}|${YEAR}(?=\s+(?:${SHORT_DIRECTIONAL}\s|${ORDINAL}\s+(?!Place\b))))`;
/** A street-name word: capitalized, and not a function word ("The Road Ahead", "Is The Way"). */
const NAME_WORD = String.raw`(?!(?:The|Is|Are|Our|Your|Own|My|His|Her|Their|Its|By|And|Of|For|To|In|On|At|With|From|Hosted|Instructor|Advisor|Professor|Prof)\b)[A-Z][a-z]+`;
// Title-case phrases that end in a street word but aren't streets.
const NOT_A_STREET = String.raw`(?!(?:One|Two|Three|Four|Five|N)[- ]Way\b|(?:Milky|Easy|Hard|Only|Right|Wrong|Other|Same|Long|Middle) Way\b|(?:[A-Z][a-z]+\s+){0,2}(?:Supreme|District|Circuit|Federal|Appeals|County|Family|High|Food|Tennis|Basketball|Volleyball|Squash|Badminton|Moot|Juvenile) Court\b|(?:[A-Z][a-z]+\s+){0,2}(?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Last|Top|Best|Final|Second-to-Last|\d{1,3}(?:st|nd|rd|th)) Place\b|(?:[A-Z][a-z]+\s+){0,2}(?:Google|Flash|Hard|Thumb|USB|Test|Disk|Shared|Network|Cloud|External|Solid|Team|One) Drive\b|(?:[A-Z][a-z]+\s+){0,2}(?:Story|Reading|Sharing|Talking|Inner|Drum|Prayer|Learning|Quality|Social|Trust|Sewing|Peace|Talent) Circle\b|(?:[A-Z][a-z]+\s+){0,2}(?:Audit|Paper|Data|Digital) Trail\b|(?:Wall|Sesame|Silk|Abbey|Memory|Penny|Electric|Tobacco) (?:Street|Road|Lane|Avenue)\b)`;
/** A ZIP code that is really a count or a measurement ("SD 15210 ms", "AR 20000 台"). */
const ZIP_END = String.raw`(?:-\d{4})?\b(?!\s*(?:(?i:ms|steps?|posts?|pairs?|samples?|tokens?|iterations?|generations?|households?|residents?|people|participants?|rpm|ppm|hz|mah|windows?|images?|words?|rows?|records?)\b|[台代张个次条人份元]))`;

const ADDRESS_PATTERNS: RegExp[] = [
  // A house number and a street: 1234 NW Example Street, 7 Elm Street, 2015 SW 16th Ave. Not
  // "Table 2 One Way ANOVA", "Team 1 First Place", "Chapter 12 The Road Ahead", "EME 6458
  // Instructor Dr. Wang" or "64 Gigabyte Flash Drive".
  new RegExp(
    String.raw`\b${HOUSE_NUMBER}\s+(?:${DIRECTIONAL}\s+)?${NOT_A_STREET}(?:${ORDINAL}\s+|${NAME_WORD}\s+){1,3}(?:${STREET_TYPE})\b\.?`,
    'g',
  ),
  // A year-like house number before a plain street name counts only where an address starts —
  // at the start of a line, or after "at" or an address label ("1950 Oak Street") — and never for
  // the famous names, so "Since 1969 Sesame Street", "The 2008 Wall Street crisis" and "那首歌叫
  // 1969 Abbey Road" stay out.
  new RegExp(
    String.raw`(?:^|(?<=\b(?:at|At|[Aa]ddress)[:\s]\s?|地址:?\s?))${YEAR}\s+${NOT_A_STREET}(?:${NAME_WORD}\s+){1,2}(?:Street|Avenue|Road|Lane|Drive|Boulevard)\b\.?`,
    'gm',
  ),
  // Numbered streets with a quadrant, as Gainesville writes them, in any case and with or without
  // dots or an ordinal: 1234 SW 20TH AVE, 1234 S.W. 20th Ave., 1234 NW 13 St, 1234 SW 35th Loop.
  new RegExp(
    String.raw`\b(?!${YEAR}\b)\d{2,6}\s+${DIRECTIONAL}\s+(?:${ORDINAL}|\d{1,3})\s+(?:${STREET_TYPES}|Loop|Run|Path)\b\.?`,
    'gi',
  ),
  // P.O. Box 12, Apt 4B, Apartment #3; Suite and Unit only in an address (after a street type or
  // before "City, ST"), so "In Unit 3, students build…" and "Test Suite 2, …" stay out.
  new RegExp(
    String.raw`\b(?:P\.?\s?O\.?\s?Box|Post Office Box|POB)\s*#?\s*\d+|\b(?:Apt|APT)\.?\s*#?\s*\d+[A-Z]?\b|\bApartment\s*(?:#\s*\d+[A-Z]?|\d+[A-Z]\b|\d+(?=,))|(?<=\b(?:${STREET_TYPES})\.?,?\s{1,2})(?:Suite|Ste\.?|Unit)\s*#?\s*\d+[A-Z]?\b|\b(?:Suite|Ste\.?|Unit)\s*#?\s*\d+[A-Z]?(?=,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2},\s*(?:${ALL_STATES})\b)|\b(?:Suite|Unit)\s*#\s*\d+`,
    'g',
  ),
  // City, state and ZIP code: "Gainesville, FL 32601", "Gainesville, Florida, 32611-1234",
  // "Pittsburgh, PA 15213". The city must be a capitalized word, so "ms, SD 15210 ms" and the
  // Chinese "台，AR 20000 台" stay out. Florida needs a Florida ZIP code (32xxx–34xxx).
  new RegExp(
    String.raw`\b[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2},\s*(?:(?:${OTHER_STATES}|${WORD_LIKE_STATES})\.?,?\s*\d{5}|(?:FL|Florida|Fla)\.?,?\s*3[2-4]\d{3})${ZIP_END}`,
    'g',
  ),
  // Without the comma, only Florida with a Florida ZIP code ("Gainesville FL 32611"): elsewhere
  // "Vanilla SD 20000 steps" and "Sample MA 10000 window" look the same.
  new RegExp(String.raw`\b[A-Z][A-Za-z]+\s+(?:FL|Florida|Fla\.),?\s+3[2-4]\d{3}${ZIP_END}`, 'g'),
  // An English street with a Chinese house number: "SW 20th Ave 1234 号".
  new RegExp(
    String.raw`\b(?:${DIRECTIONAL}\s+)?(?:${ORDINAL}|[A-Z][a-z]+)\s+(?:${STREET_TYPES})\.?\s*\d{1,6}\s?号(?![线楼门])`,
    'g',
  ),
  // Chinese addresses need an address shape, not just "路" and "号": a city or district before
  // the road (…市…区…路1037号; not "城市公交线路 3 号线" or "这条思路 1号方案"). The match is the road
  // and number; the city is checked by looking back from the road, which keeps long runs fast.
  /(?<=[一-龥](?:省|市|区|县|镇)[一-龥]{0,12})(?<![线思之])(?:路|街|大道|巷|胡同)\s?\d{1,5}\s?号(?![线位])/g,
  // An address label with a number in the same clause: "地址：某某小区5号楼", "家住…1234号".
  // Link labels (原文地址, 直播地址, GitHub地址…) and dates after a comma ("…，11号之前") are not
  // addresses, and neither are 大家住/回家住 or a date ("10月 27号").
  /(?<!原文|直播|项目|网站|网页|下载|视频|仓库|代码|论文|主页|博客|会议|活动|报名|链接|源码|官网|回放|课程|数据集|问卷|网盘|直播间|大会|开会|投稿|演示|讲座|比赛|考场|报到|内存|虚拟|IP|Demo)(?:地址|住址|(?<![大回])家住|寄到|收货地址|收件地址|门牌号)\s*(?:是|在)?\s*:?\s*[^\n,。!?;()]{0,30}?(?<![\d月日]\s?)\d{1,5}\s?号(?![线位教]|\s*(?:之前|以前|前|截止|统一|上午|下午|晚上))/g,
  // Chinese numbered roads, the way Gainesville streets are written in Chinese: 西南20大道1234号.
  /(?:东南|东北|西南|西北|东|西|南|北)\s?第?\s?\d{1,3}\s?(?:大道|街|路|巷|道)\s?\d{1,5}\s?号(?![线楼门])/g,
  // "I live on … road N号": 我住在湖滨南路 88 号.
  /(?:住在|我住|住址|租的房子在)[^\n,。!?;]{0,20}?(?:路|街|大道|巷|胡同)\s?\d{1,5}\s?号(?![线门])/g,
  // A building with a room: 5号楼302室, 3栋2单元501, 5栋1102, B 座 1203 室, 我住3号楼2门301.
  // Not "A座203教室" or "5号楼302教室" (classrooms).
  /\d{1,4}\s?(?:号楼|栋|幢)\s?(?:\d{1,3}\s?(?:单元|门)\s?)?\d{2,5}\s?室|\d{1,3}\s?单元\s?\d{2,5}\s?室|\d{1,4}\s?(?:号楼|栋|幢)\s?\d{1,3}\s?(?:单元|门)\s?\d{2,5}|\d{1,3}\s?(?:栋|幢)\s?\d{3,5}(?![\d年月日号元万个次%])|[A-Z]\s?座\s?\d{3,5}\s?室|住[^\n,。!?;]{0,6}?\d{1,4}\s?号楼\s?\d{3,5}(?![\d年月日号元万个次%])/g,
];

export function findAddresses(input: string): Finding[] {
  const text = normalizeForScan(input);
  return collect(
    text,
    ADDRESS_PATTERNS.map((pattern) => ({ category: 'street address', pattern })),
  );
}

// ---------------------------------------------------------------- facts.md §15 terms

interface TermRule {
  category: string;
  pattern: RegExp;
  /** Skipped for bundled code (check-privacy's code mode): object keys look like quotations. */
  proseOnly?: boolean;
}

const FAMILY = '§15 family members';
const HEALTH = '§15 health';
const GRADES = '§15 grades';
const IMMIGRATION = '§15 immigration or work authorization';
const JOB_SEARCH = '§15 job-search activity';
const AVAILABILITY = '§15 location or availability';
const COMPENSATION = '§15 compensation';
const PARTICIPANTS = '§15 participant data';
const CITATIONS = '§15 citation counts';

const rx = (parts: string[], flags: string) => new RegExp(parts.join('|'), flags);

// ------------------------------------------------ grades

const GPA = String.raw`(?:[cugCUG]?(?:GPA|gpa|Gpa)|G\.\s?P\.\s?A\.?|grade point average)`;
const GRADE_RULES: TermRule[] = [
  {
    // A GPA of one's own: "my GPA", a GPA with a number ("GPA: 3.92/4.00", "cGPA 3.8"), a score
    // out of 4.0 (only GPAs are written that way), a class rank. Not "prior GPA as a covariate",
    // "Mean GPA was 3.2" or "Students' GPA was not associated with interest".
    category: GRADES,
    pattern: rx(
      [
        String.raw`\bmy\s+(?:[\w-]+\s+)?${GPA}`,
        String.raw`${OWNER_POSSESSIVE}(?:${GPA}|grades)\b`,
        String.raw`(?<!\b(?:[Mm]ean|[Aa]verage|[Mm]edian|[Mm]inimum|[Mm]in\.?|[Pp]rior|[Rr]equired|[Cc]utoff|[Tt]ypical)\s(?:[\w-]+\s)?)\b${GPA}\s*(?:[:：=]|of|was|is|[-–—])?\s*[0-4](?:\.\d{1,2})?(?![\d.]*%|\w|\(\))`,
        String.raw`(?<![\d.])[0-4]\.\d{1,2}\s*\/\s*4\.0{1,2}(?![\d.])`,
        String.raw`\bclass\s+rank(?:ing)?\s*[:：]?\s*(?:top\s+)?\d`,
        String.raw`\branked\s+(?:top\s+)?\d{1,3}(?:\s*%|\s*\/\s*\d{2,4}|\s+(?:out\s+)?of\s+\d{2,4})\s+in\s+(?:my|the|our)\s+(?:class|major|cohort|department|program|year)\b`,
      ],
      'gi',
    ),
  },
  {
    // Chinese: 绩点 with a number (not 业绩点评, 战绩点, 成绩点开), and 均分/排名/成绩/高考/GRE/托福
    // only after 我 in the same clause ("我本科均分92", "我的成绩是年级第五"); "我觉得托福 100 分就够了"
    // and "QS 排名前 50 的学校" stay out.
    category: GRADES,
    pattern: rx(
      [
        String.raw`(?<![业战功政])绩点(?![评开击这名])\s*(?:是|为|只有|才|有)?\s*:?\s*\d`,
        String.raw`${ZH_I}(?:的)?${ZH_CLAUSE}{0,6}?(?:GPA|gpa|绩点|均分|加权|学分绩|排名|成绩|高考|GRE|托福|TOEFL|雅思|IELTS)${ZH_CLAUSE}{0,6}?(?:\d|第[一二三四五六七八九十])`,
        String.raw`保研排名\s*(?:是|为)?\s*(?:第\s*[\d一二三四五六七八九十]|\d|前)`,
        String.raw`(?:专业|年级|班级)排名\s*(?:是|为)?\s*(?:\d+\s*\/\s*\d+|前\s*\d+(?:\.\d+)?\s*%)`,
        String.raw`${ZH_I}${ZH_CLAUSE}{0,3}?挂(?:过|了)\s*[\d一二两三四五六七八九十几]*\s*(?:门|科)`,
      ],
      'g',
    ),
  },
];

// ------------------------------------------------ immigration and work authorization

const IMMIGRATION_RULES: TermRule[] = [
  {
    // Words that only mean immigration status. "green card" only with holder/status/process words
    // or a possessive (not "a green card to signal I understand"); "permanent resident" only for
    // one person (not "Permanent residents and seasonal visitors face flood risks"); sponsorship
    // only with visa/employer words, a first-person need or a CV label (not "without industry
    // sponsorship").
    category: IMMIGRATION,
    pattern: rx(
      [
        String.raw`\bimmigration\b`,
        String.raw`\b(?:work|employment)[- ]authori[sz]ation\b`,
        String.raw`\bgreencards?\b`,
        String.raw`\bgreen card(?:s)?\s+(?:holder|status|application|interview|lottery|process|backlog|sponsorship)\b`,
        String.raw`\b(?:my|a valid|getting a|got (?:a|my|the)|apply(?:ing)? for (?:a|the)|applied for (?:a|the))\s+green card\b`,
        String.raw`\b(?:a|an|my|U\.?S\.?|US|American|Canadian|lawful)\s+permanent resident\b(?!s)`,
        String.raw`\bpermanent resident (?:card|status)\b`,
        String.raw`\bSEVIS\b`,
        String.raw`\binternational student status\b`,
        String.raw`\bcap[- ]gap\b`,
        String.raw`\b(?:visa|employer|employment|work|H-?1-?B)\s+sponsorship\b`,
        String.raw`\bI(?:\s+(?:will|would|do|did|won't|don't|didn't|wouldn't)(?:\s+not)?|'ll|'d)?\s+(?:require|need)\s+(?:any\s+)?(?:visa\s+)?sponsorship\b`,
        String.raw`\b(?:visa\s+)?sponsorship\s+(?:is\s+)?(?:not\s+)?(?:required|needed)\b`,
        String.raw`\b(?:visa\s+)?sponsorship\s*[:：]\s*(?:yes|no|not|none|required|needed|n\/a)\b`,
        String.raw`\b(?:legally\s+)?(?:authori[sz]ed|eligible|permitted)\s+to\s+work\s+(?:in|for)\s+(?:the\s+)?(?:U\.?S\.?\b|USA?\b|United States|America|Canada|China)`,
        String.raw`\b(?:my|a valid|have a|hold a|need a)\s+work\s+permit\b`,
        String.raw`${LABEL_START}(?:work\s+permit|citizenship|nationality|visa(?:\s+status)?|immigration\s+status)\s*[:：]`,
        String.raw`\bI(?:'m| am)\s+an?\s+(?:[\w.]+\s+)?citizen\b(?!\s+(?:scien|journal|sens|report|particip))`,
        String.raw`${OWNER_POSSESSIVE}(?:visa|immigration|work authori[sz]ation|green card|OPT)\b`,
      ],
      'gim',
    ),
  },
  {
    // Case-sensitive status tokens: H-1B (not the hypotheses "H1a and H1b"), I-20 and other form
    // numbers, NIW, EB-2 (not "EB1 and EB2 are the two electrode boards", not CSS "#eb1"), F-1/J-1
    // status (not "F1 score"), OPT and CPT with a status word or a possessive (not "results on
    // OPT, LLaMA" or "scores on CPT"), and "visa" (not the card network "Payments go through
    // Visa" or "a visa card reader"). None of them after #, $, a word character, a dot or an
    // operator, so minified code ("i-20", "eb1=0") stays out.
    category: IMMIGRATION,
    pattern: rx(
      [
        String.raw`(?<![\w$#.=+\-*/(,])H-?1-?B\b`,
        String.raw`(?<![\w$#.=+\-*/(,])I-(?:20|94|129|140|485|765|797|983)\b`,
        String.raw`\bDS-(?:160|2019)\b`,
        String.raw`(?<![\w$#.])NIW\b`,
        String.raw`(?<![\w$#.])EB-[123][A-C]?\b`,
        String.raw`(?<![\w$#.])EB[123][A-C]\b`,
        String.raw`(?<![-\w])visas?\b(?!\s*(?:信用)?卡|\s+(?:cards?|debit|credit|network|payments?)\b)`,
        String.raw`\b(?:[Ss]tudent|[Ww]ork|[Tt]ourist|H-?1-?B|F-?1|J-?1|O-1) [Vv]isa\b`,
        String.raw`\bVisa (?:status|application|interview|sponsorship|issues?|appointment|delays?|processing|renewal|denial|refusal|stamping|wait)\b`,
        String.raw`\b[FJ]-?1\s+(?:[Vv]isa|status|student|scholar|OPT|CPT|holder)\b(?![- ](?:teacher|model|network|distillation|score))`,
        String.raw`\b[Ss]tudent\s*\((?:F|J)-?1\)`,
        String.raw`\bOPT (?:EAD|extension|status|authori[sz]ation|application|period|start|unemployment|STEM)\b`,
        String.raw`\bCPT (?:status|authori[sz]ation|extension|application|period)\b`,
        String.raw`\bSTEM OPT\b`,
        String.raw`\b(?:[Mm]y|on (?:my|an?)|apply(?:ing)? for|applied for)\s+(?:STEM\s+)?(?:OPT|CPT|EAD)\b(?![-\w])`,
        String.raw`\bI(?:'m| am| was)\s+(?:currently\s+|still\s+)?on\s+(?:an?\s+|my\s+)?(?:STEM\s+)?(?:OPT|CPT|F-?1|J-?1|H-?1-?B)\b(?![-\w])`,
        String.raw`\bEAD [Cc]ard\b`,
      ],
      'g',
    ),
  },
  {
    // Chinese immigration words count anywhere, with the compounds that mean something else left
    // out: 自签证书 (self-signed certificate), 人工签到/手工签名/员工签字, 数字/数码/数位移民 (digital
    // immigrants), 移民火星, 面签贷款合同, 学生签署/签了同意书, 身份证/身份认同, OPT the language model.
    category: IMMIGRATION,
    pattern: rx(
      [
        String.raw`签证(?!书)`,
        String.raw`绿卡`,
        String.raw`(?<![人手员加施])工签(?![到名字收约署])`,
        String.raw`(?<!数字|数码|数位|数字化)移民(?!火星)`,
        String.raw`(?<![A-Za-z\d-])[FJM]-?1\s*(?:身份|学生签?|签证?|状态|快?过期|快?到期)`,
        String.raw`${ZH_I}(?:现在|目前)?(?:是|拿的是|持)\s*[FJM]-?1\b`,
        String.raw`\b(?:OPT|CPT)\b(?![-\w])\s*(?:期间|延期|申请|身份|工卡|卡|到期|过期|快到期|失业|开始|结束|批了|下来|实习)`,
        String.raw`(?:我的|申请|做|开始|明年|今年|拿到)\s*(?:STEM\s*)?(?:OPT|CPT)\b(?![-\w])`,
        String.raw`(?<![确担环])保身份(?![证信认验安])`,
        String.raw`(?:转|掉|黑)身份(?![证信认验])`,
        String.raw`维持(?:合法)?身份(?![证信认同验])`,
        String.raw`身份(?:黑了|过期|到期|快到期)`,
        String.raw`${ZH_I}${ZH_CLAUSE}{0,6}?没有身份(?![信认证标验])`,
        String.raw`美签(?![名字约到收章署])`,
        String.raw`(?<![当见会])面签(?![字署名收约章合贷])`,
        String.raw`(?:学生|工作|旅游|探亲)签(?![名字约到收章署了订发])`,
        String.raw`回国续签|续美签`,
        String.raw`(?:签证|美签|面签|学生签)${ZH_CLAUSE}{0,6}?被\s*check`,
        String.raw`被\s*check\s*了?\s*[\d一二两三四五六七八九十百千几]+\s*(?:个月|周|天)`,
        String.raw`行政审查`,
        String.raw`\b221\s*\(?g\)?(?![\w])`,
        String.raw`等工卡|工卡(?:下来|批了|到手|过期|延期)`,
        String.raw`\bEAD\s*(?:卡|下来|批|到了)`,
        String.raw`(?:发了?|拿到了?|收到了?|新的?|签了?)\s*I-?20\b`,
        String.raw`\bI-?20\s*(?:表|上的|过期|延期|签字)`,
        String.raw`永居`,
        String.raw`${ZH_I}${ZH_CLAUSE}{0,6}?(?:入籍|永久居民)`,
        String.raw`抽签\s*(?:没中|没抽中|中了)(?!奖)`,
        String.raw`(?:[Hh]-?1-?[Bb]|[Ee][Bb]-?[123][A-Ca-c]?)\s*(?:抽签|抽中|排期|申请|绿卡|petition)`,
      ],
      'g',
    ),
  },
];

// ------------------------------------------------ family members

const KID_NOUNS =
  'wife|husband|spouse|sons?|daughters?|kids?|child|children|bab(?:y|ies)|toddlers?|infants?|newborns?|parents?|mother|father|mom|mum|dad|twins|teen(?:ager)?s?|kiddos?|firstborn|step(?:sons?|daughters?|kids|children)';
const RELATIVES = String.raw`brothers?|sisters?|siblings?|grand(?:ma|pa|mother|father|parents?|sons?|daughters?|kids?|children)|cousins?|aunts?|uncles?|nephews?|nieces?|in-laws|(?:brother|sister|mother|father|son|daughter)s?-in-law`;
// Words after a family noun that make it something else: "my baby thermometer", "my child
// nodes", "my mother tongue", "my family of models", "my brother-in-arms".
const NOT_FAMILY_AFTER =
  'thermometers?|monitors?|agenc(?:y|ies)|organi[sz]ations?|schools?|hospitals?|labs?|sites?|institutions?|friendly|participants?|stud(?:y|ies)|users?|data|products?|projects?|teachers?|universit(?:y|ies)|compan(?:y|ies)|nodes?|elements?|components?|props|containers?|widgets?|selectors?|scope|frames?|windows?|process(?:es)?|class(?:es)?|directory|tongue|tree|of|in-arms|boards?|city|district|museum|library|community|classroom|team|conferences?|journals?|papers?|repos?|apps?|pipelines?|version|survey|book|corpus|sample|prototypes?';
const NOT_FAMILY = String.raw`(?![-' ](?:${NOT_FAMILY_AFTER})\b)(?!\s+who\s+code)`;
const NUMBER_WORD = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';

// Chinese family nouns with the compounds they must not match: 老公司/老公众号/老公寓, 老婆饼,
// 对象存储, 我爱人工智能/人机/人生/人间/人文/人类, 我先生成/生图/生个/生活, 母亲河.
const ZH_PARTNER = String.raw`老婆(?![饼婆])|老公(?![司众寓园交开路共社])|媳妇(?!熬)|太太|妻子|丈夫|爱人(?![工类民机生间文性们如己])|女朋友|男朋友|女友|男友|未婚妻|未婚夫|对象(?![存被])|先生(?![成产效存长动图个活吞搬出硬词])`;
const ZH_KIDS = String.raw`儿子|女儿|闺女|孩子(?!们)|宝宝(?!们)|小孩(?![子们])|娃(?![娃们])`;
const ZH_PARENTS = String.raw`父母|母亲(?![河节])|父亲(?!节)|爸爸(?![呀啊耶哟诶欸吖呦])|妈妈(?![呀啊耶哟诶欸吖呦])|爸妈|岳父|岳母|公公|婆婆`;
const ZH_AGE = String.raw`[\d一二两三四五六七八九十]+\s*(?:个|岁半?|个多?月)(?:大)?的?`;

const FAMILY_RULES: TermRule[] = [
  {
    // A family member of one's own: "my wife", "my two kids", "my amazing wife", "my 3-year-old",
    // "our second child", "father of two", "Jimmy's wife", "my partner". Not "our children" or
    // "their parents" (research language), "my research with children", "my target children",
    // "my 5-year-old laptop", "my partner school", "my partner on this project".
    category: FAMILY,
    pattern: rx(
      [
        String.raw`\bmy\s+(?:ex-)?(?:${KID_NOUNS}|${RELATIVES}|family|girls|boys|little (?:ones?|guy|girl|boy|man|lady)|better half)\b${NOT_FAMILY}(?!\s+of\s+a\s+gun)`,
        String.raw`\bmy\s+(?!(?:research|study|studies|work|interview|interviews|participant|participants|target|student|students|lab|own|pilot|sample|survey|baby)\b)[\w-]+\s+(?:${KID_NOUNS}|${RELATIVES})\b${NOT_FAMILY}`,
        String.raw`\bmy\s+(?:\d+|${NUMBER_WORD})[- ](?:year|month|week)[- ]olds?\b(?!\s+(?:laptop|computer|car|phone|MacBook|bike|dog|cat|puppy|kitten|code|codebase|project|repo|paper|dataset|account|house|machine|PC|iPad|iPhone|thesis)\b)`,
        String.raw`\bour\s+(?:(?:first|second|third|fourth|new|newborn|little|baby|youngest|oldest|eldest|older|younger|two|three|\d+[- ](?:year|month)[- ]old)\s+)?(?:sons?|daughters?)\b${NOT_FAMILY}`,
        String.raw`\bour\s+(?:first|second|third|fourth|new|newborn)\s+(?:child|baby|kid)\b|\bour\s+(?:little ones?|firstborn)\b`,
        String.raw`\b(?:we're|we are|I'm|I am)\s+expecting\s+(?:a|our|my)\s+(?:\w+\s+)?(?:baby|child)\b`,
        String.raw`\bmy\s+(?!(?:research|lab|project|business|work|thesis|study|coding|hackathon|teaching|writing|industry|community|school|dance|tennis|debate|accountability|co-?author)\b)(?:[\w-]+\s+)?(?:partner|significant other|girlfriend|boyfriend|fianc[eé]e?)\b${NOT_FAMILY}(?!\s+(?:on|in|for|at|from|with)\s+(?:this|the|that|a|our|my)\s+(?:project|hackathon|team|competition|course|class|lab|study|paper|work)\b)`,
        String.raw`\b(?:father|mother|dad|mom|mum|parent)\s+(?:of|to)\s+(?:two|three|four|five|six|\d|twins|an?\s+(?:toddler|newborn|baby|preschooler|teenager|\d+[- ](?:year|month)[- ]old))\b(?!\s+(?:nodes?|elements?|components?|processes|items|classes)\b)`,
        String.raw`\b(?:I'm|I am)\s+an?\s+(?:new\s+|first-time\s+|working\s+|proud\s+|stay-at-home\s+|single\s+)?(?:dad|father|mom|mother|mum|parent)\b(?![- ](?:nodes?|class|elements?|components?|process|containers?|directory|window|frame)\b)`,
        String.raw`${OWNER_POSSESSIVE}(?:wife|husband|spouse|partner|sons?|daughters?|kids?|children|bab(?:y|ies)|family|parents|mother|father|mom|dad|brothers?|sisters?|in-laws)\b`,
      ],
      'gi',
    ),
  },
  {
    // Chinese: spouse words anywhere (老婆说…, 老公做饭), and children, parents and relatives after
    // 我/我的/我和/我们的 ("我三岁的女儿", "我的两个孩子", "我们的女儿"). Not 我们的孩子 (our children in
    // general), 我的孩子们 (my students), 我的妈呀 (an exclamation), 我家老板/导师/实验室 (my advisor,
    // my lab), 我家乡, 我们家庭教育/家长群/家族.
    category: FAMILY,
    pattern: rx(
      [
        String.raw`(?<!二次元|纸片人|没有)老婆(?![饼婆])`,
        String.raw`(?<!老)老公(?![司众寓园交开路共社])`,
        String.raw`媳妇(?!熬)`,
        String.raw`丈母娘|老丈人|岳父母|(?:孩子|娃)他(?:妈|爸)`,
        String.raw`${ZH_I}(?:们俩的|们的(?=女儿|儿子|宝宝|闺女)|的|和|跟|与|家的?)?(?:${ZH_AGE}|刚出生的|大|小(?!孩子)|二)?(?:${ZH_KIDS}|${ZH_PARTNER}|${ZH_PARENTS})`,
        String.raw`${ZH_I}(?:的)?(?:哥哥|姐姐|弟弟|妹妹|哥(?!们|儿们|伦)|姐(?!妹)|弟(?!子|兄)|妹(?!子)|奶奶|爷爷|外婆|外公|姥姥|姥爷|舅舅|舅妈|姑姑|姑父|姨妈|姨夫|叔叔|伯伯|表哥|表姐|表弟|表妹|堂哥|堂姐|堂弟|堂妹|侄子|侄女|外甥女?|公婆|老爸|老妈|爹(?![啊呀耶])|娘(?![啊呀耶])|妻(?!子)|孙子|孙女)`,
        String.raw`${ZH_I}(?:的)?(?:妈|爸)(?![妈爸呀啊耶哟诶欸吖呦咧!?,。….])`,
        String.raw`${ZH_I}(?:们)?家(?!乡|庭|老板|导师|实验室|组|长|族|里没|的(?:老板|导师)|人工)`,
        String.raw`(?:和|跟|与|陪)爱人(?![工类民机生间文性们如己])`,
        String.raw`${ZH_I}(?:已经|刚)?结婚(?:了|[\d一二两三四五六七八九十]+年)`,
      ],
      'g',
    ),
  },
];

// ------------------------------------------------ health

const CONDITIONS = String.raw`ADHD|autism|depression|anxiety|cancer|diabetes|PTSD|OCD|bipolar(?: disorder)?|epilepsy|long COVID|COVID(?:-19)?|migraines?|insomnia|dyslexia|asthma|(?:a )?(?:mental|physical|learning) (?:illness|disability|disorder)|chronic \w+|an? eating disorder|a stroke|a heart attack|an? (?:panic|anxiety) disorder|leukemia|lupus|multiple sclerosis`;
const HEALTH_RULES: TermRule[] = [
  {
    // One's own health: "I have ADHD", "I was diagnosed with…", "I'm autistic", "my therapist",
    // "my surgery", "I was on paternity leave", "for personal health reasons", "I am pregnant".
    // Not "Children diagnosed with ADHD", "my diagnosis: a cold solder joint", "the child's
    // medical history", "participants on parental leave were excluded" or "Our pregnancy app".
    category: HEALTH,
    pattern: rx(
      [
        String.raw`\b(?:I was|I've been|I have been|I am|I'm|I got|I was recently|I've recently been)\s+diagnosed\b`,
        String.raw`我被\s*diagnosed`,
        String.raw`\bmy\s+diagnosis\s+(?:of|with)\s+(?:${CONDITIONS})\b`,
        String.raw`\bI\s+(?:have|had|live with|lived with|struggle with|struggled with|suffer from|suffered from|got|caught|am being treated for|was treated for)\s+(?:an?\s+|chronic\s+)?(?:${CONDITIONS})\b`,
        String.raw`\bI(?:'m| am| was)\s+(?:autistic|disabled|neurodivergent|chronically ill|pregnant|hospitali[sz]ed)\b`,
        String.raw`\bmy\s+(?:therapist|therapy|psychiatrist|medications?|meds|surgery|illness|disability|chronic\s+\w+|depression|anxiety disorder|ADHD|autism|cancer|pregnancy|miscarriage|medical (?:leave|condition|history|records?))\b(?![-\w])`,
        String.raw`\b(?:my|I was on|I am on|I'm on|I took|I'll be on|I will be on|I went on)\s+(?:a\s+)?(?:\w+\s+)?(?:maternity|paternity|parental|sick|medical|bereavement|mental[- ]health)\s+leave\b`,
        String.raw`请了?\s*(?:a\s+)?(?:medical|sick|maternity|paternity|parental)\s+leave`,
        String.raw`\b(?:took|take|taking|went on)\s+(?:a\s+)?(?:medical\s+)?leave of absence\b`,
        String.raw`\b(?:for|due to)\s+(?:personal|my own|my|family)\s+(?:health|medical)\s+reasons\b`,
        String.raw`\bdue to my health\b`,
        String.raw`${OWNER_POSSESSIVE}(?:health|illness|diagnosis|therapist|surgery|pregnancy|disability)\b`,
      ],
      'gi',
    ),
  },
  {
    // Chinese, after 我: 确诊/诊断/得了 a condition, 我有焦虑症, 住院, 做了手术, 看心理医生, 怀孕, 陪产假.
    // Not 我在研究抑郁症, 我有一个抑郁症数据集, 我得了第一名, 我得了新冠研究的资助, 我做了个手术机器人的项目,
    // 我的病人, 怀孕期间的饮食建议.
    category: HEALTH,
    pattern: rx(
      [
        String.raw`${ZH_I}(?:也|曾|曾经|当时|后来|一直|去年|今年)?(?:被)?(?:确诊|诊断|查出|患上|患有|得了|得过)(?:了|为|出|过)?${ZH_CLAUSE}{0,6}?(?:抑郁|焦虑|双相|惊恐|强迫症|ADHD|多动症|自闭|癌|肿瘤|白血病|糖尿病|新冠|肺炎|心脏病|高血压|精神分裂|进食障碍|失眠症)(?![研数项论模课题资疫])`,
        String.raw`${ZH_I}(?:也|一直)?有(?:轻度|中度|重度|严重的)?(?:抑郁症?|焦虑症|双相|惊恐障碍|强迫症|ADHD|多动症|糖尿病|心脏病|高血压)(?![研数项论模课题资])`,
        String.raw`${ZH_I}(?:是)?(?:癌症|抑郁症|糖尿病)患者|${ZH_I}是(?:双相|抑郁症|焦虑症)`,
        String.raw`${ZH_I}(?:也|曾|曾经|当时|后来|去年|今年|刚|又|已经)?(?:住院(?!医)|住了[\d一二两三四五六七八九十几]*\s*(?:天|周|个月)\s*(?:医院|ICU)|做了?(?:个|一次|一个)?手术(?!机器人|器械|视频|模拟|导航|规划|室)|开刀|做化疗|化疗|放疗|流产|怀孕|怀上了|(?:去)?看(?:了)?心理医生|在?吃抗抑郁药)`,
        String.raw`(?:老婆|妻子|太太|媳妇|爱人|她)(?:已经|刚)?怀孕`,
        String.raw`怀孕(?:[\d一二两三四五六七八九十]+(?:周|个月))`,
        String.raw`${ZH_I}(?:的)?(?:心理咨询师|心理医生|主治医生)`,
        String.raw`${ZH_I}的病(?![人毒例历房床理])`,
        String.raw`陪产假|${ZH_I}${ZH_CLAUSE}{0,4}?休了?产假`,
        String.raw`休学${ZH_CLAUSE}{0,6}?治病`,
        String.raw`舍曲林|氟西汀|帕罗西汀|艾司西酞普兰|文拉法辛|安非他酮`,
      ],
      'g',
    ),
  },
];

// ------------------------------------------------ compensation

const AMOUNT_BIG = String.raw`(?:[$¥€£]\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[$¥€£]\s?\d+(?:\.\d+)?\s?[kK]\b|\b\d{2,3}(?:\.\d)?[kK]\b)`;
const PER_PERIOD = String.raw`[$¥€£]\s?\d+(?:\.\d+)?\s*(?:\/|per\s+|an?\s+)(?:hour|hr|year|yr|month|mo)\b`;
const COMP_WORD = String.raw`(?:stipend|salary|salaries|base(?: pay| salary)?|total comp(?:ensation)?|TC|signing bonus|sign-on bonus|RSUs?|equity|offer|assistantship)`;
const ZH_AMOUNT = String.raw`(?:[$¥]\s*\d[\d,]*(?:\.\d+)?|[\d一二两三四五六七八九十百千几]+(?:[.,]\d+)?\s*(?:万|千|k|K|w|W|刀|美元|美金|块|元)(?:刀|美元|美金|元)?)`;

const COMPENSATION_RULES: TermRule[] = [
  {
    // Pay of one's own or on a CV: a pay label at the start of a line ("Salary: …",
    // "<dt>Compensation:", "Pay: $25/hr"), "my salary/stipend", an amount of $1,000+ or Nk next to
    // a pay word ("a $30,000 stipend", "$150k offer", "base $150K + equity"), "I earn $28k",
    // "signing bonus". Not study payments ("Compensation: $20 gift card", "Participants received
    // compensation: $20"), "my pay-as-you-go credits", "base pay on Prolific was $12 per hour" or
    // "teachers earn a median salary of $50,000".
    category: COMPENSATION,
    pattern: rx(
      [
        String.raw`${LABEL_START}(?:salary|salaries|compensation|expected (?:salary|compensation)|desired salary|pay(?:\s+rate)?|hourly rate|wages?|stipend|total comp(?:ensation)?|base salary)\s*(?:[:：]|[—–]\s)(?![^\n]{0,40}\b(?:gift ?cards?|participants?|per (?:session|participant|interview|survey)|course credit|extra credit|raffle)\b)`,
        String.raw`(?<!\b(?:median|average|mean|typical|starting|minimum|annual|national|base)\s)\bsalary of\s*[$¥€£\d]`,
        String.raw`\b(?:expected|desired|asking)\s+(?:salary|salaries|compensation)\b`,
        String.raw`\bsalary\s+(?:expectations?|requirements?|negotiations?|history)\b`,
        String.raw`\bcompensation\s+(?:package|expectations?)\b`,
        String.raw`\bmy\s+(?:[\w-]+\s+)?(?:salary|salaries|compensation|pay(?![- ](?:as[- ]you[- ]go|rate|scale|gap|per|wall|-?off))|wages?|stipend|income|earnings|hourly rate|pay rate|offer letter)\b`,
        String.raw`${OWNER_POSSESSIVE}(?:salary|stipend|pay|compensation|income|offer)\b`,
        String.raw`\b(?:signing|sign-on)\s+bonus\b`,
        String.raw`(?-i:\bRSUs\b)`,
        String.raw`${AMOUNT_BIG}[^.\n]{0,40}?\b${COMP_WORD}\b`,
        String.raw`(?<!\b(?:median|average|mean|typical|starting|minimum|national)\s)\b(?:${COMP_WORD}|offered)\b[^.\n]{0,25}?${AMOUNT_BIG}`,
        String.raw`\b(?:I make|I earn|I earned|I was paid|I get paid|I am paid|I'm paid|I got paid)\b[^.\n]{0,25}?(?:${AMOUNT_BIG}|${PER_PERIOD})`,
        String.raw`\bpaid\s+${PER_PERIOD}\s+as\s+an?\s+(?:RA|TA|GA|intern|research assistant|teaching assistant|graduate assistant)\b`,
      ],
      'gim',
    ),
  },
  {
    // Chinese: a pay word after 我 ("我的年薪", "我工资8000", "我的奖学金每年 3 万刀"), a pay word with an
    // amount standing as its own clause ("年薪30万", "总包 45w", "RA 工资每月 2300 刀"), a pay label
    // ("薪资：面议") and offer amounts ("我拿了 25k 的 offer"). Not general talk: "硅谷新人工程师的年薪
    // 20万美元左右", "月薪 3 万在北京也就是普通水平", "面试官问期望薪资的时候", "我系博士生补助 2000 元".
    category: COMPENSATION,
    pattern: rx(
      [
        String.raw`${ZH_I}(?:们)?(?:的)?(?:年薪|月薪|工资|薪资|薪水|时薪)`,
        String.raw`${ZH_I}(?:们)?${ZH_CLAUSE}{0,6}?(?:收入|奖学金|补助|津贴|stipend|工资|薪水)${ZH_CLAUSE}{0,8}?(?:${ZH_AMOUNT}|\d{3,})`,
        String.raw`${ZH_I}${ZH_CLAUSE}{0,6}?(?:一个月|每月|每个月|一年|每年)\s*(?:能)?(?:拿|有|到手|税前|税后)\s*${ZH_AMOUNT}`,
        String.raw`${ZH_ALONE_BEFORE}(?:年薪|月薪|时薪|总包|年包|包裹|签字费|税前|税后|到手|薪资|工资|薪水|(?:RA|TA|GA)\s*(?:工资|补助))\s*(?:是|有|约|大概|大约|才|只有|不到|超过|接近)?\s*(?:每月|每个月|一个月|每年|一年)?\s*:?\s*${ZH_AMOUNT}(?:左右|以上|多)?${ZH_ALONE_AFTER}`,
        String.raw`${ZH_ALONE_BEFORE}(?:TC|base|stipend)\s+(?:每月|每个月|一个月|每年|一年)?\s*(?:[$¥]\s?\d{1,3}(?:,\d{3})+|[$¥]?\d+(?:\.\d+)?\s*(?:万|千|k|K|w|W|刀))${ZH_ALONE_AFTER}`,
        String.raw`${ZH_ALONE_BEFORE}(?:薪资|工资|薪水|待遇)\s*:`,
        String.raw`${ZH_ALONE_BEFORE}(?:期望|预期)(?:薪资|年薪|月薪|工资)`,
        String.raw`offer\s*(?:给了|开了)\s*[\d一二两三四五六七八九十百千几]+`,
        String.raw`\d+(?:\.\d+)?\s*(?:k|K|w|W|万)\s*(?:刀\s*)?的\s*offer`,
      ],
      'gm',
    ),
  },
];

// ------------------------------------------------ job search

// Companies whose name after "interviews with/at" means a job interview, not a study.
const EMPLOYERS =
  'Google|Meta|Facebook|Microsoft|Amazon|Apple|Adobe|IBM|Intel|NVIDIA|Nvidia|Netflix|Uber|Airbnb|OpenAI|Anthropic|Salesforce|LinkedIn|Duolingo|Snap|ByteDance|TikTok|Tencent|Alibaba|Baidu|Huawei|Samsung|Oracle|Qualcomm|Bloomberg|Spotify|Pinterest|Coursera|Pearson|Stripe';
/** After an employer: a product or a group of people, so the interviews were a study. */
const EMPLOYER_STUDY_AFTER = String.raw`(?!\s+(?:(?-i:[A-Z][\w-]*)\s+){0,2}(?:users?|owners?|workers?|drivers?|employees|learners?|listeners?|viewers?|creators?|teachers?|students?|customers?|sellers?|hosts?|riders?|participants?|engineers?|designers?|researchers?|staff|managers?|developers?|subscribers?|members?|moderators?|contractors?|volunteers?)\b|\s+(?-i:Classroom|Docs|Drive|Meet|Scholar|Watch|Quest|Teams|Alexa|Mechanical|Maps|Glass|Home|Assistant|Translate|Forms|Sheets|Slides|Earth|Lens|Echo|Kindle|Pixel|Vision|HoloLens|Copilot|Office|Word|Excel|Gemini|Llama|Horizon|Workspace|Search|Music|Prime|Azure|Bing)\b)`;
/** After "I interviewed at/with/for": a study, a school or a tool, so a research interview. */
const RESEARCH_SITE = String.raw`(?:Study|Phase|Session|Wave|Round|Zoom|Teams|Skype|UF|Teachers?|Students?|Parents?|Participants?|Families|Residents)\b|(?:[A-Z][\w.'-]*\s+){1,4}(?:High|Middle|Elementary|Public|County|School|Schools|Library|Museum|Hospital|Center|Centre|Clinic|Park|District)\b`;
const JOB_QUAL = String.raw`(?:full[- ]time|part[- ]time|faculty|postdoc(?:toral)?|tenure[- ]track|TT|UX|summer|fall|spring|internship|job|academic|industry|research(?: scientist)?|remote|new|entry[- ]level|engineering|software|\d{4})`;
const JOB_NOUN = String.raw`(?:jobs?|roles?|positions?|internships?|postdocs?|opportunit(?:y|ies)|employment|offers?)`;

const JOB_SEARCH_RULES: TermRule[] = [
  {
    // One's own job search: "I'm on the market", "I applied to 40 schools", "I accepted an offer",
    // "Currently seeking full-time roles", "Open to work", "my job talk", "hiring committee", and
    // CV fragments at the start of a line ("Seeking faculty positions…", "Interviewed at Stripe").
    // Not research ("phone interviews with parents", "interviews with Google Classroom teachers",
    // "I interviewed at Gainesville High School"), not job search as a topic ("We studied how job
    // seekers use LLMs for job search", "mock job interviews", "Students applying for jobs"), and
    // not "seeking the positions of the hands".
    category: JOB_SEARCH,
    pattern: rx(
      [
        String.raw`\bmy\s+job[- ](?:search|hunt(?:ing)?|applications?|offers?|interviews?|talk)\b`,
        String.raw`\bmy\s+(?:[\w-]+\s+)?(?:job[- ]market paper|offer letter|faculty applications?|postdoc applications?)\b`,
        String.raw`${OWNER_POSSESSIVE}(?:job[- ]search|job (?:offers?|applications?|interviews?|talk)|offers?)\b`,
        String.raw`\bjob[- ](?:search|hunt)(?:ing)?\s+(?:update|status|journey|diary|log|season|recap)\b`,
        String.raw`\bjob[- ]market\s+(?:candidates?|papers?)\b`,
        String.raw`\b(?:I'm|I am|I'll be|I will be|I was|I'm going to be|I am going to be|I plan to be)\s+(?:\w+\s+)?on\s+the\s+(?:academic\s+|faculty\s+|industry\s+|tenure-track\s+|job\s+)?market\b`,
        String.raw`\bon the (?:academic|faculty|tenure-track) (?:job )?market\b`,
        String.raw`\bI(?:'ve|'d| have| had)?\s+(?:just\s+|also\s+|finally\s+)?(?:accepted|received|got|gotten|have|had|declined|turned down|negotiated|signed)\s+(?:an?\s+|the\s+|my\s+|two\s+|three\s+|multiple\s+|several\s+|\d+\s+)?(?:(?:job|faculty|tenure-track|TT|postdoc|industry|full-time|return|verbal|written|competing|final)\s+)?offers?\b(?!\s+(?:to\s+(?:participate|take part|help|join)|of\s+(?:help|support|assistance)))`,
        String.raw`\b(?:verbal|tenure-track|faculty|postdoc)\s+(?:job\s+)?offers?\b`,
        String.raw`\bturned down (?:an?|the|their|two|\d+) (?:job )?offers?\b`,
        String.raw`\bI(?:'ve| have| had)?\s+(?:just\s+)?accepted\s+(?:an?|the)\s+(?:[\w-]+\s+){0,3}?(?:position|role|job|offer)\b`,
        String.raw`\bI(?:'ve| have| had)?\s+(?:just\s+|also\s+|already\s+)?applied\s+(?:to|for|at)\s+(?!(?:an?\s+|the\s+)?(?:[\w-]+\s+)?(?:grants?|fellowships?|IRB|travel|funding|awards?|scholarships?|dataset|data|model|problem|method|approval|permission|conferences?)\b)(?:\d+|several|many|dozens|(?:an?\s+)?(?:job|position|role|postdoc|internship|faculty)|(?:the\s+)?(?-i:[A-Z]))`,
        String.raw`\bI(?:'ve| have)?\s+(?:submitted|sent out|sent)\s+(?:\d+|\w+)\s+(?:job\s+|faculty\s+)?applications\b`,
        String.raw`(?:\bI(?:'m| am| was| will be|'ll be)\s+(?:currently\s+|actively\s+|now\s+|also\s+|still\s+)?|\bcurrently\s+|\bactively\s+)(?:looking for|seeking|searching for|applying (?:for|to))\s+(?:(?:a|an|my next|new|the)\s+)?(?:[\w-]+\s+){0,3}?${JOB_NOUN}\b(?!\s+(?:of|to|for\s+(?:collaborat|research|partner)))`,
        String.raw`${LABEL_START}(?:looking for|seeking|searching for|applying (?:for|to))\s+(?:(?:a|an|new)\s+)?(?:${JOB_QUAL}\s+){1,3}${JOB_NOUN}\b`,
        String.raw`${LABEL_START}open\s+to\s+(?:${JOB_QUAL}\s+){0,3}(?:roles?|positions?|jobs?|opportunities|offers|work\b)`,
        String.raw`\bI(?:'m| am)\s+(?:also\s+|currently\s+|always\s+)?open\s+to\s+(?:${JOB_QUAL}\s+){0,3}(?:roles?|positions?|jobs?|opportunities|offers)\b(?!\s+(?:for|to|in)\s+(?:collaborat|work with|partner|research))`,
        String.raw`#OpenToWork\b`,
        String.raw`\bmy\s+(?:job|final[- ]round|on-?site|on-?campus)\s+interviews?\b`,
        String.raw`\b(?:my|an?)\s+(?:on-?site|on-?campus|campus|phone|first[- ]round|second[- ]round|final[- ]round|faculty|job|zoom|virtual)\s+(?:interview|visit)s?\s+(?:at|with|for)\s+(?:the\s+)?(?!(?:Dr|Prof|Mr|Ms|Mrs)\.?\s)(?-i:[A-Z])`,
        String.raw`\binterview(?:s|ed|ing)?\s+(?:with|at)\s+(?-i:${EMPLOYERS})\b${EMPLOYER_STUDY_AFTER}`,
        String.raw`${LABEL_START}interviewed\s+(?:at|with|for)\b`,
        String.raw`\b(?:an?|my|two|three|\d+)\s+(?:on-?sites?|fly-?outs?)\s+(?:at|with)\s+(?!the\b)(?-i:[A-Z])`,
        String.raw`\b(?:campus|faculty|academic|job)\s+fly-?outs?\b|\bI\s+had\s+(?:\w+\s+)?fly-?outs?\b`,
        String.raw`(?:\bI(?:'m| am)\s+(?:currently\s+|actively\s+)?|${LABEL_START}(?:currently|actively)\s+)interviewing\s+for\s+(?:[\w-]+\s+){0,3}(?:roles?|positions?|jobs?|internships?)\b`,
        String.raw`\bhiring committee\b|\bfaculty search committee\b`,
        String.raw`\b(?:my|gave\s+(?:a|my)|give\s+(?:a|my)|giving\s+(?:a|my)|prepar(?:e|ed|ing)\s+(?:a|my))\s+job\s+talk\b`,
      ],
      'gim',
    ),
  },
  {
    // Case-sensitive: "I interviewed at Google", not "we interviewed at three schools" or "I
    // interviewed at Gainesville High School / for Study 2 / with Zoom".
    category: JOB_SEARCH,
    pattern: new RegExp(
      String.raw`\bI(?:'ve| have| had)?\s+(?:also\s+|recently\s+|just\s+)?interview(?:ed|ing)\s+(?:with|at|for)\s+(?:the\s+|a\s+|an\s+)?(?!${RESEARCH_SITE})[A-Z]`,
      'g',
    ),
  },
  {
    // Chinese: job-search words after 我 in the same clause ("我正在找工作", "我在找教职"), narrative
    // forms that only describe one's own search ("投了 50 份简历", "拿到了 offer", "面了 5 家",
    // "签了三方"), and the words standing alone as a title or tag ("求职", "秋招", "电面"). Not the
    // topic in general ("很多学生毕业后找工作很难", "春招和秋招的区别", "很多同学拿到offer以后"), and not
    // 要求职业, 找工作流, 查找工作表, 开春招生, 中秋招待, 学校招生, 最终面临, 充电面板.
    category: JOB_SEARCH,
    pattern: rx(
      [
        String.raw`${ZH_I}(?:们)?${ZH_CLAUSE}{0,10}?(?:(?<![要追寻需请力])求职(?![业称场])|(?<!查)找工作(?![流室表簿台区坊量])|(?<!开)春招(?!生)|(?<!中)秋招(?!待)|投(?:了)?${ZH_CLAUSE}{0,8}?简历|找(?:\s*faculty)?\s*(?:教职(?![工员])|博后|博士后|postdoc|职位|实习)|申(?:请)?(?:了)?${ZH_CLAUSE}{0,8}?(?:教职(?![工员])|职位)|(?:on-?site|onsite)\s*面试|(?:准备|打算|想|要)跳槽|campus visit|(?:上|在|进入)\s*(?:the\s+)?(?:job\s+)?market|offer|[二三]面|终面|电面)`,
        String.raw`投了\s*(?:[\d一二两三四五六七八九十百千几]+\s*(?:多|来)?\s*(?:份|个|家)\s*)?简历`,
        String.raw`(?:拿到了|收到了|拿了|接了|接受了|拒了|拒绝了|签了)\s*(?:${ZH_CLAUSE}{0,12}?(?:的|个)\s*)?(?:return\s+)?offer`,
        String.raw`offer\s*(?:被\s*)?(?:rescind|撤回|撤销)`,
        String.raw`面了\s*[\d一二两三四五六七八九十几]+\s*家`,
        String.raw`签了三方`,
        String.raw`投了${ZH_CLAUSE}{0,4}?(?:postdoc|博后|教职)`,
        String.raw`申(?:请)?了\s*[\d一二两三四五六七八九十百千几]+\s*(?:多)?\s*(?:个|所)\s*(?:学校的\s*)?(?:AP|TT|教职|faculty)`,
        String.raw`(?:去|到)\s*[A-Z][\w&.]*\s*面试`,
        String.raw`求内推`,
        String.raw`(?:分享|发|写)(?:一下|一篇|一份)?\s*面经`,
        String.raw`[二三四]面(?:过了|挂了|通过)`,
        String.raw`${ZH_ALONE_BEFORE}(?:求职|找工作|秋招|春招|校招|社招|投简历|找实习|电面|终面|HR\s*面|面试挂了|简历被(?:刷|挂)|教职面试|(?:今年|明年)?申教职|拿到(?:了)?\s*教职|拿到\s*${ZH_CLAUSE}{0,12}?(?:return\s+)?offer|准备跳槽)${ZH_ALONE_AFTER}`,
      ],
      'gm',
    ),
  },
];

// ------------------------------------------------ location and availability

const AVAIL_WHEN = String.raw`(?:${MONTH_OR_SEASON}|\d{4}|graduation|my (?:defense|graduation|Ph\.?D\.?))`;
const NOT_RELOCATE_OBJECT = String.raw`(?!\s+(?:the|a|an|it|this|that|these|those|my|our|its|his|her|their)\b)`;

const AVAILABILITY_RULES: TermRule[] = [
  {
    // When or where one can work: "I'm available from January 2027", "I can start in January",
    // "I can't relocate", "I need to stay in Florida", "two-body problem", CV labels ("Start date:
    // June 2027", "<li>Availability: Summer 2027", "Relocation: Yes") and CV fragments at the
    // start of a line ("Available immediately", "Open to relocation"). Not "The robot is able to
    // move", "I would relocate the battery", "I'll be available after the talk", "Slides
    // (available from December 2026)", "Data availability:" or "Study start date: March 2024".
    category: AVAILABILITY,
    pattern: rx(
      [
        String.raw`\b(?:I am|I'm|I will be|I'll be|I'd be|I would be|I become|I'll become|I will become|am)\s+(?:\w+\s+)?available\s+(?:to (?:start|join|begin)\b|for (?:full[- ]time|part[- ]time|employment|hire|positions?|roles?|a (?:position|role|job))|(?:starting|from|beginning|as of|after)\s+(?:in |on )?${AVAIL_WHEN}|immediately|in ${AVAIL_WHEN}(?!\s+(?:\d{4}\s+)?(?:for|at|to)\s+(?!full|part|employ|positions?|roles?|work|hire)))`,
        String.raw`\bI(?:\s+(?:can|could|will|would|plan to|intend to|hope to|want to|am (?:able|willing|happy|open|ready) to|can(?:no|')t|can not|could(?:n't| not)|will not|won't|would(?:n't| not)|am (?:not |un)(?:able|willing) to)|'d|'ll|'m (?:not |un)?(?:able|willing|happy|open|ready) to)\s+relocate\b${NOT_RELOCATE_OBJECT}`,
        String.raw`\b(?:I am|I'm|I will be|I'll be|I'd be|I would be|I was)\s+(?:\w+\s+)?relocating\b${NOT_RELOCATE_OBJECT}`,
        String.raw`${LABEL_START}(?:relocating|moving)\s+to\s+(?-i:[A-Z])`,
        String.raw`${LABEL_START}(?:willing|open|happy|able|ready)\s+to\s+relocate\b`,
        String.raw`\bopen to relocation\b`,
        String.raw`\bI(?:\s+(?:can|could|will|would|am able to|plan to)|'d be able to|'ll be able to|'ll|'d)\s+(?:\w+\s+)?start\s+(?:(?:in|on|from|by|after|as early as)\s+(?:${MONTH_OR_SEASON}|\d{4}|early|late|mid|my|graduation|the defense)|immediately|right away|right after)`,
        String.raw`(?:\bI(?:'m| am)\s+|${LABEL_START})(?:free|ready)\s+to\s+start\s+(?:in|on|from|after|immediately|right)\b`,
        String.raw`\bI(?:\s+(?:(?:need|have|want|prefer|plan|hope|would like|would prefer)\s+to|must|should|will)|'d (?:like|prefer) to|'ll)\s+(?:stay|remain|live|be based|be located)\s+(?:in|near|close to)\s+(?:the\s+)?(?!HCI\b|CS\b|Academia\b|touch\b)(?-i:[A-Z])`,
        String.raw`\bI(?:'m| am)\s+(?:\w+\s+)?geographically\s+(?:flexible|constrained|limited|restricted|mobile)\b`,
        String.raw`\btwo[- ]body problem\b`,
        String.raw`${LABEL_START}open\s+to\s+remote(?:\s+(?:work|roles?|positions?|jobs?))?\b|\bI(?:'m| am)\s+open\s+to\s+remote\b|\bI can only work remotely\b|\bremote[- ]only\s+(?:roles?|positions?|jobs?)\b`,
        String.raw`${LABEL_START}(?:relocation|willing to relocate)\s*(?:[:：]|[—–]\s)`,
        String.raw`${LABEL_START}(?:(?:expected|earliest|possible|preferred|desired)\s+start(?:\s+date)?|start\s+date)\s*(?:[:：]|[—–]\s)\s*(?:\|\s*)?(?:${MONTH_OR_SEASON}|\d|immediately|ASAP|negotiable|flexible)`,
        String.raw`${LABEL_START}(?:availability|available)\s*(?:[:：]|[—–]\s)\s*(?:\|\s*)?(?:available\s+)?(?:immediate(?:ly)?|now|from|starting|beginning|after|as of|${MONTH_OR_SEASON}|\d{4}|full[- ]time|part[- ]time)\b`,
        String.raw`${LABEL_START}status\s*[:：]\s*available\s+(?:immediately|now|from|starting|beginning|after|as of|in)\b`,
        String.raw`${LABEL_START}notice period\s*[:：]\s*\d`,
        String.raw`\bmy\s+(?:(?:earliest|expected|preferred|possible)\s+)?start date\b|\bmy notice period\b`,
        String.raw`${LABEL_START}available\s+(?:immediately|(?:from|starting|beginning)(?:\s+in|\s+on)?\s+(?:${MONTH_OR_SEASON}|\d{4})|${MONTH_OR_SEASON}\s+\d{4}|for\s+(?:full[- ]time|part[- ]time|employment|hire|positions?|roles?|work)\b)`,
        String.raw`${OWNER_POSSESSIVE}(?:availability|start date|relocation)\b`,
      ],
      'gim',
    ),
  },
  {
    // Chinese: start dates and staying put, after 我 in the same clause ("我明年秋天入职", "我不能离开
    // 美国", "我会搬到西雅图"), "随时可以入职", and start-date labels with a date ("入职时间：2027年1月").
    // Not "入职时间：一般在七月", "新员工入职培训", "数据不能离开美国" or "我会搬到新的实验室".
    category: AVAILABILITY,
    pattern: rx(
      [
        String.raw`${ZH_ALONE_BEFORE}(?:最早)?(?:可)?(?:入职|到岗|上岗)(?:时间|日期)\s*:\s*(?:20\d{2}|\d{1,2}\s*月|明年|今年|随时|立即|马上|下个?月|年初|年底|毕业)`,
        String.raw`(?:随时|立即|马上)(?:可以|能)?(?:入职|到岗|上岗)`,
        String.raw`${ZH_I}${ZH_CLAUSE}{0,8}?(?:明年|今年|下个月|下半年|年初|年底|毕业后?|[\d一二两三四五六七八九十]+\s*月|20\d{2}\s*年)${ZH_CLAUSE}{0,8}?(?:(?:可以|就|会|将|要|能)?\s*(?:入职|到岗|开始工作|上岗)|就?可以工作)`,
        String.raw`(?:[\d一二两三四五六七八九十]+\s*月|明年|今年)${ZH_CLAUSE}{0,4}?(?:可以|就可以|能)\s*(?:入职|到岗|开始工作|上岗)`,
        String.raw`${ZH_I}${ZH_CLAUSE}{0,6}?(?:不能|无法|没法|不可以|暂时不能)(?:离开|出)(?:美国|佛州|佛罗里达|境|国)`,
        String.raw`${ZH_I}${ZH_CLAUSE}{0,4}?(?:愿意|可以|能|打算|准备|会|要)(?:搬到|搬去)(?!新的?|实验室|办公室|服务器|大楼|楼|线上|云|GitHub)`,
        String.raw`(?:接受|可以)\s*(?:relocate|remote)\b`,
        String.raw`${ZH_I}(?:已经)?入职了`,
        String.raw`${ZH_I}得待在(?:美国|佛州|佛罗里达|国内|盖恩斯维尔|Gainesville)`,
      ],
      'gm',
    ),
  },
];

// ------------------------------------------------ participant data

const QUOTE_OPEN = String.raw`["“‘'«「『]`;
const SAID = String.raw`(?:said|says|noted|explained|described|recalled|reported|shared|mentioned|stated|told us|commented|added|wrote|remarked|put it|emphasi[sz]ed|admitted|complained)`;
const ZH_SAID = String.raw`(?:说|提到|表示|告诉我|回忆|解释|写道|的原话是)`;
/** A participant label "P7", not a figure or part label ("图 P2", "Phase P1") or an object key. */
const P_LABEL = String.raw`(?<!["']\s?,\s?|\{\s?)(?<!(?:图|视频|第|集|Figure|Fig\.|Part|Phase|Step|Table)\s?)\bP\d{1,3}\b`;

const PARTICIPANT_RULES: TermRule[] = [
  {
    // Quotations attributed to a participant: 'P7: "…"', 'P7 said, "…"', '"…" (P7)', 'P7 (F, 34):
    // "…"', 'Participant 7: "…"', 'P3 说：“…”', '受访者P7说‘…’', and participant IDs ("Participant ID:
    // A12", "被试编号 023"). A bare 'P1：“入门”' with a short label is a video part, not a quotation.
    // Not "Participant ID was replaced with a random code", "P1 到 P35 都完成了任务" or "受访者普遍说".
    category: PARTICIPANTS,
    proseOnly: true,
    pattern: rx(
      [
        String.raw`["”'»」]\s*\(\s*P\d{1,3}\b`,
        String.raw`\[P\d{1,3}\]\s*[:：]?\s*${QUOTE_OPEN}`,
        String.raw`${P_LABEL}\s*\([^)\n]{1,30}\)\s*[:：—–,]?\s*${QUOTE_OPEN}`,
        String.raw`${P_LABEL}\s*(?:${SAID}(?:\s+that)?\s*[,:]?|\s*${ZH_SAID}\s*,?\s*:?)\s*${QUOTE_OPEN}`,
        String.raw`${P_LABEL}\s*[:：—–]\s*${QUOTE_OPEN}[^"”’'»」』\n]{5,}`,
        String.raw`${P_LABEL}\s*[:：]\s*I\b`,
        String.raw`\b(?:[Pp]articipant|Teacher|Student|Interviewee|Respondent)\s+[A-Z]?\d{1,3}\s*(?:\([^)\n]{1,30}\)\s*)?(?:${SAID}(?:\s+that)?\s*[,:]?|[:：])\s*${QUOTE_OPEN}`,
        String.raw`\b(?:Participant|Interviewee|Respondent)\s+\d{1,3}\s*[:：]`,
        String.raw`\b[Pp]articipant\s+(?:ID|#)\s*[:#]?\s*[A-Z]{0,3}-?\d+\b`,
        String.raw`(?:受访者|参与者|被试|访谈对象)\s*[A-Z]?\d{0,3}\s*(?:\([^)\n]{1,24}\))?\s*(?:跟我|对我)?(?:说|提到|表示|告诉我|回忆|解释|写道)(?:道)?\s*[,:]?\s*${QUOTE_OPEN}`,
        String.raw`(?:被试|参与者|受访者)(?:编号|ID|号)\s*:?\s*[A-Z]?\d{1,4}(?!\s*(?:到|至|-|~))`,
        String.raw`(?:参与者|被试|受访者)\s*#\s*\d+(?!\s*(?:到|至|-|~)\s*#?\d)`,
      ],
      'g',
    ),
  },
];

// ------------------------------------------------ citation counts

const COUNT_LEAD_OUT = String.raw`(?<![\d,.])(?<!\b(?:up to|at most|max(?:imum)?|top|first|last|the|produced|generated|checked|verified|returned|lists?|includes?|contains?|added|removed|of)\s)`;
const CITATION_RULES: TermRule[] = [
  {
    // Exact citation counts and indices: "cited by 120", "has received 45 citations", "cited 87
    // times", "Citation count: 87", "h-index", "我的论文被引用了 52 次", "h指数 4". Not "up to 3
    // citations", "312 citations the model produced", "Citations: 1 to 3 links", "cited by 2
    // participants", or general talk ("这篇论文被引用10万多次"). Not "h-index" inside an identifier.
    category: CITATIONS,
    pattern: rx(
      [
        String.raw`\bcited by\s*[:：]?\s*(?:over\s+|more than\s+|nearly\s+|about\s+|~)?\d[\d,]*(?![\d,]*\s+(?:participants?|reviewers?|students?|teachers?|people|respondents?|users?|experts?|interviewees?))`,
        String.raw`\bcited\s+(?:over\s+|more than\s+|nearly\s+|about\s+|~)?\d[\d,]*\+?\s+times\b`,
        String.raw`(?<![{,"'\w])\bcitations?(?:\s+count)?\s*[:：]\s*\d(?!\d*\s*(?:to|-|–)\s*\d|\d*\s+(?:per|links?|pages?)\b)`,
        String.raw`\btotal\s+citations\s*[:：]?\s*\d`,
        String.raw`(?<![#$\w.=-])h[- ]?index\b(?![-\w])`,
        String.raw`\bi10[- ]index\b`,
        String.raw`${COUNT_LEAD_OUT}\b(?:\d{1,3}(?:,\d{3})+|\d{2,})\+?\s+citations\b(?!\s+(?:the|were|are|was|generated|produced|per|across|in (?:the|each|all|our)|from the model))`,
        String.raw`${ZH_I}(?:的|们的)?${ZH_CLAUSE}{0,12}?(?:被引|引用量|引用数|引用次数|总引用|citations?|引用\s*(?=\d))${ZH_CLAUSE}{0,8}?(?:\d|[一二两三四五六七八九十百千]+\s*(?:次|个|多))`,
        String.raw`\b(?:h|i10)\s*-?\s*指数\s*(?:是|为|有|:)?\s*\d`,
        String.raw`(?:谷歌学术|Google\s*Scholar|Scholar)${ZH_CLAUSE}{0,10}?(?:引用|citations?)${ZH_CLAUSE}{0,6}?\d`,
        String.raw`(?:谷歌学术|Google\s*Scholar|Scholar)${ZH_CLAUSE}{0,10}?\d+\s*(?:多|余)?\s*(?:次|个)?\s*(?:引用|citations?)`,
        String.raw`${ZH_ALONE_BEFORE}(?:被引(?:用)?次数|总被引|引用次数|总引用)\s*:?\s*\d`,
      ],
      'gim',
    ),
  },
];

/** Words that signal a facts.md §15 category, plus the retired framing from facts.md §5.1. */
export const SECTION_15_TERMS: readonly TermRule[] = [
  ...GRADE_RULES,
  ...IMMIGRATION_RULES,
  ...FAMILY_RULES,
  ...HEALTH_RULES,
  ...COMPENSATION_RULES,
  ...JOB_SEARCH_RULES,
  ...AVAILABILITY_RULES,
  ...PARTICIPANT_RULES,
  ...CITATION_RULES,
  {
    category: 'retired framing (facts.md §5.1)',
    pattern: /\bdecision matrix\b|\b18% name-only\b|\bself-report missed 38%/gi,
  },
];

/**
 * Stricter family rule for fetched YouTube titles only (D54): any mention of a child, partner
 * or relative keeps a title off the site. Far too broad for page text or repository names
 * ("baby thermometer", "urban digital twins"). Chinese 一家/老大/家庭 count only as family
 * ("一家人", "老大第一天上学", "家庭日常"), not "一家AI教育初创公司", "老大难问题" or "家庭作业".
 */
const TITLE_FAMILY_NOUNS = `${KID_NOUNS}|family|in-laws|little ones?|partner|boys?|girls?|preschoolers?|eldest|youngest|oldest|siblings?|sisters?|brothers?|grand(?:ma|pa|mother|father|parents?|kids?|children)|nephews?|nieces?|little (?:guy|girl|boy|man|lady)`;
const TITLE_FAMILY = new RegExp(
  String.raw`\b(?:my|our|his|her|their)\s+(?:\w+\s+)?(?:${TITLE_FAMILY_NOUNS})\b|\b(?:sons?|daughters?|toddlers?|newborns?|infants?|twins|wife|husband|kids?|kiddos?|bab(?:y|ies)|child|children|preschoolers?|firstborn|grand(?:ma|pa|mother|father|parents?)|mom|mommy|mum|dad|daddy|famil(?:y|ies)|kindergarten|daycare|preschool|(?:big|little) (?:sister|brother))\b|\b\d+[\s-]?(?:yo|y\/o|yrs?|years?|mos?|months?)(?:[- ]olds?)?\b|\bage[sd]?\s*\d{1,2}\b|\blittle ones?\b|儿子|女儿|宝宝|宝贝|孩子|小孩|小朋友|儿童|亲子|老婆|老公|太太|媳妇|闺女|娃|老大(?!难)|老二|大宝|二宝|小宝|奶爸|宝妈|育儿|爸爸|妈妈|老爸|老妈|姐姐|弟弟|哥哥|妹妹|我家|我们家|全家|一家(?:人|子|三口|四口|五口|老小)|家庭(?!作业)`,
  'i',
);

export function findSection15Terms(input: string, options: { code?: boolean } = {}): Finding[] {
  const text = normalizeForScan(input);
  return collect(
    text,
    SECTION_15_TERMS.filter((rule) => !(options.code && rule.proseOnly)),
  );
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
