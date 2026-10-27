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
  findAddresses,
  findEmails,
  findPhones,
  findSection15Terms,
  lineOf,
  mask,
} from './lib/privacy-rules.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const TEXT_EXTENSIONS = new Set([
  '.astro',
  '.css',
  '.csv',
  '.html',
  '.htm',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.cjs',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.webmanifest',
  '.xml',
  '.yaml',
  '.yml',
  '.toml',
  '.htaccess',
  '',
]);
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

// The checker's own rules and tests contain sample patterns on purpose.
const SELF = [
  'scripts/lib/privacy-rules.ts',
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

function scanText(file: string, text: string, scope: 'repo' | 'dist'): Result[] {
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
    push(findSection15Terms(text), 'error');
  } else if (!startsWithAny(file, TERM_SCAN_EXEMPT)) {
    push(findSection15Terms(text), startsWithAny(file, TERM_SCAN_WARN_ONLY) ? 'warning' : 'error');
  }
  return results;
}

async function scanImage(file: string, scope: 'repo' | 'dist'): Promise<Result[]> {
  try {
    const meta = await sharp(join(ROOT, file)).metadata();
    const report = describeImageMetadata(meta);
    const results: Result[] = [];
    if (report.hasLocation) {
      results.push({
        file,
        line: 0,
        category: 'image location metadata',
        match: report.details.join(', '),
        severity: 'error',
      });
    } else if (scope === 'dist' && (report.hasExif || report.hasXmp || report.hasIptc)) {
      // Astro's image pipeline strips metadata, so any left in the output means an image
      // bypassed it (D31: photos go through src/assets, never raw into public/).
      results.push({
        file,
        line: 0,
        category: 'image metadata in build output',
        match: 'EXIF/XMP/IPTC present',
        severity: 'error',
      });
    }
    return results;
  } catch {
    return [
      {
        file,
        line: 0,
        category: 'unreadable image',
        match: 'could not read metadata',
        severity: 'warning',
      },
    ];
  }
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
    if (IMAGE_EXTENSIONS.has(ext)) {
      counted++;
      results.push(...(await scanImage(file, scope)));
    } else if (TEXT_EXTENSIONS.has(ext) || file.endsWith('.htaccess')) {
      counted++;
      results.push(...scanText(file, readFileSync(join(ROOT, file), 'utf8'), scope));
    } else if (ext === '.pdf') {
      results.push({
        file,
        line: 0,
        category: 'PDF not text-scanned',
        match: 'review by hand',
        severity: 'warning',
      });
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
