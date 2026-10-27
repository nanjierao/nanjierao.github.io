// npm run check:privacy — scan the repository and the build output for things that must not be
// public (CLAUDE.md, D31, D39): phone numbers, unexpected email addresses, street addresses,
// facts.md §15 terms, and image metadata (GPS/EXIF location).
//
//   node scripts/check-privacy.ts          repository, plus dist/ when it exists
//   node scripts/check-privacy.ts --repo   repository only
//   node scripts/check-privacy.ts --dist   build output only (runs after every build)
//
// Exits 1 on any finding that isn't allowlisted in scripts/privacy-allowlist.json. Allowlist
// entries name the file and the SHA-256 fingerprint (first 16 hex digits) that each finding
// prints, never the value itself, so the allowlist can't spread what it allows.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PERSON } from '../src/data/site.ts';
import {
  type Finding,
  describeImageMetadata,
  exifHasGps,
  findAddresses,
  findEmails,
  findPhones,
  findSection15Terms,
  lineOf,
  mask,
  normalizeForScan,
  stripLicenseComments,
  xmpHasLocation,
} from './lib/privacy-rules.ts';
import {
  convertFirstKind,
  findDataUriImages,
  isFontFile,
  readImageMetadata,
  unscannableKind,
} from './lib/image-metadata.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
]);
// Font files: no personal data to look for.
const FONT_EXTENSIONS = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);
// Everything else is read as text unless it contains NUL bytes. Binary files this script can't
// look inside (PDFs, video, audio, office files, archives, .ico) fail until someone reviews the
// exact file by hand and allowlists its content fingerprint.

// The checker's own rules and tests contain sample patterns on purpose.
const SELF = [
  'scripts/lib/privacy-rules.ts',
  'scripts/lib/filter-external.ts',
  'scripts/privacy-allowlist.json',
  'tests/unit/privacy-rules.test.ts',
];

// Files that define the §15 categories or discuss them as rules. They are scanned for phone
// numbers, email addresses and street addresses like everything else, but not for §15 words.
const TERM_SCAN_EXEMPT = [
  'CLAUDE.md',
  'README.md',
  'content/facts.md',
  'docs/',
  '.claude/',
  'scripts/',
  'tests/',
];
// Drafts for later sessions and archived source material: §15 words are reported as warnings
// (review before they reach a page), not failures.
const TERM_SCAN_WARN_ONLY = ['content/', 'source/'];

interface AllowEntry {
  file: string;
  fingerprint: string;
  reason: string;
}

interface Result {
  file: string;
  line: number;
  category: string;
  match: string;
  severity: 'error' | 'warning';
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function startsWithAny(file: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));
}

function loadAllowlist(): AllowEntry[] {
  const path = join(ROOT, 'scripts', 'privacy-allowlist.json');
  if (!existsSync(path)) return [];
  const entries = JSON.parse(readFileSync(path, 'utf8')) as AllowEntry[];
  for (const entry of entries) {
    if (!entry.file || !/^[0-9a-f]{16}$/.test(entry.fingerprint ?? '') || !entry.reason) {
      throw new Error('privacy-allowlist.json: every entry needs file, fingerprint and reason');
    }
  }
  return entries;
}

function repositoryFiles(): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => existsSync(join(ROOT, file)) && statSync(join(ROOT, file)).isFile());
}

function distFiles(dir = DIST): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...distFiles(path));
    else files.push(toPosix(relative(ROOT, path)));
  }
  return files;
}

const CODE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.css']);

function scanText(file: string, raw: string, scope: 'repo' | 'dist'): Result[] {
  const code = CODE_EXTENSIONS.has(extname(file).toLowerCase());
  // The rules normalize too; doing it here keeps their match positions and lineOf in step.
  const text = normalizeForScan(code ? stripLicenseComments(raw) : raw);
  const results: Result[] = [];
  const allowedEmails = PERSON.email ? [PERSON.email] : [];
  const push = (findings: Finding[], severity: Result['severity']) => {
    for (const f of findings) {
      results.push({
        file,
        line: lineOf(text, f.index),
        category: f.category,
        match: f.match,
        severity,
      });
    }
  };
  push(findPhones(text), 'error');
  push(findEmails(text, allowedEmails), 'error');
  push(findAddresses(text), 'error');
  if (scope === 'dist') {
    push(findSection15Terms(text, { code }), 'error');
  } else if (!startsWithAny(file, TERM_SCAN_EXEMPT)) {
    push(
      findSection15Terms(text, { code }),
      startsWithAny(file, TERM_SCAN_WARN_ONLY) ? 'warning' : 'error',
    );
  }
  return results;
}

/** Image formats this check can't fully read: convert them before committing. */
const CONVERT_FIRST = new Set(['.tif', '.tiff', '.heic', '.heif']);
/** Extensions treated as unscannable even when their bytes look like text. */
const UNSCANNABLE_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.key',
  '.pages',
  '.numbers',
  '.zip',
  '.gz',
  '.tgz',
  '.7z',
  '.rar',
  '.tar',
  '.mp4',
  '.mov',
  '.m4v',
  '.webm',
  '.avi',
  '.mkv',
  '.mp3',
  '.m4a',
  '.wav',
  '.ogg',
  '.flac',
  '.aac',
  '.ico',
  '.psd',
  '.ai',
  '.eps',
  '.sketch',
  '.fig',
  '.bin',
  '.db',
  '.sqlite',
]);

function sha(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Any metadata block in an image is an error (D31, facts.md §15); comments are scanned as text. */
async function checkImageBytes(
  file: string,
  bytes: Uint8Array,
  scope: 'repo' | 'dist',
  where = '',
): Promise<Result[]> {
  const results: Result[] = [];
  const convert = convertFirstKind(bytes);
  if (convert) {
    return [
      {
        file,
        line: 0,
        category: `${convert}${where}: convert to JPEG, PNG or WebP (metadata not fully checkable)`,
        match: `sha256:${sha(bytes)}`,
        severity: 'error',
      },
    ];
  }
  const raw = readImageMetadata(bytes);
  let sharpReport: ReturnType<typeof describeImageMetadata>;
  try {
    sharpReport = describeImageMetadata(await sharp(bytes).metadata());
  } catch {
    return [
      {
        file,
        line: 0,
        category: `unreadable image${where} (metadata not checked)`,
        match: `sha256:${sha(bytes)}`,
        severity: 'error',
      },
    ];
  }
  const blocks = new Set([...raw.blocks, ...sharpReport.details]);
  const location =
    raw.exif.some((exif) => exifHasGps(exif)) ||
    raw.xmp.some((xmp) => xmpHasLocation(xmp)) ||
    sharpReport.hasLocation;
  if (blocks.size > 0 || location) {
    const kind = location
      ? 'image location metadata'
      : scope === 'dist'
        ? 'image metadata in build output'
        : 'image metadata in repository (npm run strip-images)';
    results.push({
      file,
      line: 0,
      category: `${kind}${where}: ${[...blocks].join(', ')}`,
      match: `sha256:${sha(bytes)}`,
      severity: 'error',
    });
  }
  for (const text of raw.texts) {
    for (const finding of scanText(file, text, scope)) {
      results.push({ ...finding, line: 0, category: `image comment${where}: ${finding.category}` });
    }
  }
  return results;
}

async function scanImage(
  file: string,
  bytes: Uint8Array,
  scope: 'repo' | 'dist',
): Promise<Result[]> {
  if (CONVERT_FIRST.has(extname(file).toLowerCase())) {
    return [
      {
        file,
        line: 0,
        category: 'convert to JPEG, PNG or WebP before committing (metadata not fully checkable)',
        match: `sha256:${sha(bytes)}`,
        severity: 'error',
      },
    ];
  }
  return checkImageBytes(file, bytes, scope);
}

/** Images embedded as base64 data URIs in text files go through the same check. */
async function scanDataUris(file: string, text: string, scope: 'repo' | 'dist'): Promise<Result[]> {
  const results: Result[] = [];
  for (const embedded of findDataUriImages(text)) {
    const where = ` (data URI at line ${lineOf(text, embedded.index)})`;
    if (embedded.type === 'svg+xml') {
      results.push(...scanText(file, Buffer.from(embedded.bytes).toString('utf8'), scope));
    } else {
      results.push(...(await checkImageBytes(file, embedded.bytes, scope, where)));
    }
  }
  return results;
}

async function scan(
  files: string[],
  scope: 'repo' | 'dist',
): Promise<{ results: Result[]; counted: number }> {
  const results: Result[] = [];
  let counted = 0;
  for (const file of files) {
    if (SELF.includes(file)) continue;
    const ext = extname(file).toLowerCase();
    const bytes = readFileSync(join(ROOT, file));
    counted++;
    const unscannable = (kind: string): Result => ({
      file,
      line: 0,
      category: `can't look inside ${kind} (review the file by hand, then allowlist it)`,
      match: `sha256:${sha(bytes)}`,
      severity: 'error',
    });
    if (IMAGE_EXTENSIONS.has(ext) || CONVERT_FIRST.has(ext)) {
      results.push(...(await scanImage(file, bytes, scope)));
    } else if (FONT_EXTENSIONS.has(ext)) {
      if (!isFontFile(bytes)) results.push(unscannable(`a ${ext} file that is not a font`));
    } else {
      const kind = unscannableKind(bytes) ?? (UNSCANNABLE_EXTENSIONS.has(ext) ? ext : null);
      if (kind) results.push(unscannable(kind));
      else if (bytes.subarray(0, 8192).includes(0))
        results.push(unscannable(`${ext || 'a'} binary file`));
      else {
        const text = bytes.toString('utf8');
        results.push(...scanText(file, text, scope));
        results.push(...(await scanDataUris(file, text, scope)));
      }
    }
  }
  return { results, counted };
}

function fingerprint(match: string): string {
  return createHash('sha256').update(match).digest('hex').slice(0, 16);
}

function isAllowed(result: Result, allowlist: AllowEntry[]): boolean {
  // Files in public/ are copied to dist/ unchanged, so an entry for one covers the other.
  const sourceFile = result.file.startsWith('dist/')
    ? `public/${result.file.slice(5)}`
    : result.file;
  const print = fingerprint(result.match);
  return allowlist.some(
    (entry) =>
      (entry.file === result.file || entry.file === sourceFile) && entry.fingerprint === print,
  );
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const doRepo = args.has('--repo') || !args.has('--dist');
  const doDist = args.has('--dist') || !args.has('--repo');
  const allowlist = loadAllowlist();
  const all: Result[] = [];

  if (doRepo) {
    const { results, counted } = await scan(repositoryFiles(), 'repo');
    console.log(`check:privacy: scanned ${counted} repository files`);
    all.push(...results);
  }
  if (doDist) {
    if (existsSync(DIST)) {
      const { results, counted } = await scan(distFiles(), 'dist');
      console.log(`check:privacy: scanned ${counted} files in dist/`);
      all.push(...results);
    } else if (args.has('--dist')) {
      console.error('check:privacy: dist/ not found; run `npm run build` first');
      process.exit(1);
    } else {
      console.log('check:privacy: dist/ not found; build output not scanned (run `npm run build`)');
    }
  }

  const reported = all.filter((r) => !isAllowed(r, allowlist));
  const errors = reported.filter((r) => r.severity === 'error');
  const warnings = reported.filter((r) => r.severity === 'warning');
  for (const r of [...errors, ...warnings]) {
    const where = r.line ? `${r.file}:${r.line}` : r.file;
    console.log(
      `${r.severity === 'error' ? 'ERROR' : 'warn '} ${where}  [${r.category}]  ${mask(r.match)}  fingerprint ${fingerprint(r.match)}`,
    );
  }
  const allowed = all.length - reported.length;
  console.log(
    `check:privacy: ${errors.length} error(s), ${warnings.length} warning(s)` +
      (allowed ? `, ${allowed} allowlisted` : ''),
  );
  if (errors.length > 0) process.exit(1);
}

await main();
