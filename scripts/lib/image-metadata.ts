// Byte-level metadata detection for check:privacy. sharp reads only the metadata it finds in
// an image's header, so this walks each container itself: JPEG segments, PNG chunks (also after
// the image data), GIF extension blocks and WebP chunks, plus a whole-file search for EXIF and
// XMP signatures as a backstop. Comments and text chunks are returned as text for the text rules.
import { inflateSync } from 'node:zlib';

export interface RawImageMetadata {
  /** Metadata blocks found: EXIF, XMP, IPTC, raw profiles. Any of these fails the check. */
  blocks: string[];
  /** EXIF or XMP payloads, for the location check. */
  exif: Uint8Array[];
  xmp: Uint8Array[];
  /** Free-text comments (JPEG COM, PNG text chunks, GIF comments), scanned like page text. */
  texts: string[];
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  Buffer.from(bytes.subarray(start, start + length)).toString('latin1');

function indexOf(bytes: Uint8Array, needle: string, from = 0): number {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).indexOf(
    needle,
    from,
    'latin1',
  );
}

function walkJpeg(bytes: Uint8Array, out: RawImageMetadata): void {
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1]!;
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      marker === 0xff ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      i += marker === 0xff ? 1 : 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // end of image, or start of scan data
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    const payload = bytes.subarray(i + 4, i + 2 + length);
    if (marker === 0xe1) {
      if (ascii(payload, 0, 6) === 'Exif\0\0') {
        out.blocks.push('EXIF');
        out.exif.push(payload);
      } else if (
        indexOf(payload, 'http://ns.adobe.com/xap/1.0/') === 0 ||
        indexOf(payload, '<x:xmpmeta') >= 0
      ) {
        out.blocks.push('XMP');
        out.xmp.push(payload);
      }
    } else if (marker === 0xed) {
      out.blocks.push('IPTC/Photoshop');
    } else if (marker === 0xfe) {
      out.texts.push(Buffer.from(payload).toString('utf8'));
    }
    i += 2 + length;
  }
}

function pngText(type: string, data: Uint8Array): { keyword: string; text: string } {
  const zero = data.indexOf(0);
  const keyword = ascii(data, 0, zero < 0 ? data.length : zero);
  const rest = data.subarray(zero + 1);
  try {
    if (type === 'tEXt') return { keyword, text: Buffer.from(rest).toString('latin1') };
    if (type === 'zTXt') return { keyword, text: inflateSync(rest.subarray(1)).toString('latin1') };
    // iTXt: compression flag, method, language tag \0, translated keyword \0, text
    const compressed = rest[0] === 1;
    let at = 2;
    for (let nulls = 0; nulls < 2 && at < rest.length; at++) if (rest[at] === 0) nulls++;
    const body = rest.subarray(at);
    return { keyword, text: (compressed ? inflateSync(body) : Buffer.from(body)).toString('utf8') };
  } catch {
    return { keyword, text: '' };
  }
}

function walkPng(bytes: Uint8Array, out: RawImageMetadata): void {
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = Buffer.from(bytes.subarray(i, i + 4)).readUInt32BE(0);
    const type = ascii(bytes, i + 4, 4);
    const data = bytes.subarray(i + 8, i + 8 + length);
    if (type === 'eXIf') {
      out.blocks.push('EXIF');
      out.exif.push(data);
    } else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      const { keyword, text } = pngText(type, data);
      if (/^XML:com\.adobe\.xmp$/i.test(keyword)) {
        out.blocks.push('XMP');
        out.xmp.push(Buffer.from(text));
      } else if (/^Raw profile type /i.test(keyword)) {
        out.blocks.push(`raw ${keyword.slice(17)} profile`);
      } else {
        out.texts.push(`${keyword}: ${text}`);
      }
    }
    if (type === 'IEND') break;
    i += 12 + length;
  }
}

function walkGif(bytes: Uint8Array, out: RawImageMetadata): void {
  const skipSubBlocks = (at: number, collect?: number[]): number => {
    while (at < bytes.length && bytes[at] !== 0) {
      const size = bytes[at]!;
      if (collect) collect.push(...bytes.subarray(at + 1, at + 1 + size));
      at += size + 1;
    }
    return at + 1;
  };
  let i = 13;
  const flags = bytes[10]!;
  if (flags & 0x80) i += 3 * 2 ** ((flags & 0x07) + 1);
  while (i < bytes.length) {
    const block = bytes[i];
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = bytes[i + 1];
      if (label === 0xfe) {
        const text: number[] = [];
        i = skipSubBlocks(i + 2, text);
        out.texts.push(Buffer.from(text).toString('latin1'));
      } else if (label === 0xff) {
        const id = ascii(bytes, i + 3, 11);
        if (id === 'XMP DataXMP') out.blocks.push('XMP');
        i = skipSubBlocks(i + 2 + 1 + bytes[i + 2]!);
      } else {
        i = skipSubBlocks(i + 2 + 1 + bytes[i + 2]!);
      }
    } else if (block === 0x2c) {
      const local = bytes[i + 9]!;
      i += 10;
      if (local & 0x80) i += 3 * 2 ** ((local & 0x07) + 1);
      i = skipSubBlocks(i + 1);
    } else {
      break;
    }
  }
}

function walkWebp(bytes: Uint8Array, out: RawImageMetadata): void {
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = ascii(bytes, i, 4);
    const size = Buffer.from(bytes.subarray(i + 4, i + 8)).readUInt32LE(0);
    const data = bytes.subarray(i + 8, i + 8 + size);
    if (type === 'EXIF') {
      out.blocks.push('EXIF');
      out.exif.push(data);
    } else if (type === 'XMP ') {
      out.blocks.push('XMP');
      out.xmp.push(data);
    }
    i += 8 + size + (size % 2);
  }
}

/** Walk an image file's structure for metadata blocks and comments. */
export function readImageMetadata(bytes: Uint8Array): RawImageMetadata {
  const out: RawImageMetadata = { blocks: [], exif: [], xmp: [], texts: [] };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) walkJpeg(bytes, out);
  else if (ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') walkPng(bytes, out);
  else if (ascii(bytes, 0, 3) === 'GIF') walkGif(bytes, out);
  else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') walkWebp(bytes, out);
  // Backstop for any format and any position: EXIF and XMP signatures anywhere in the file.
  const exifAt = indexOf(bytes, 'Exif\0\0');
  if (
    !out.blocks.includes('EXIF') &&
    exifAt >= 0 &&
    /^(?:MM\0\*|II\*\0)$/.test(ascii(bytes, exifAt + 6, 4))
  ) {
    out.blocks.push('EXIF');
    out.exif.push(bytes.subarray(exifAt));
  }
  if (
    !out.blocks.includes('XMP') &&
    (indexOf(bytes, '<x:xmpmeta') >= 0 || indexOf(bytes, 'http://ns.adobe.com/xap/1.0/') >= 0)
  ) {
    out.blocks.push('XMP');
    out.xmp.push(bytes);
  }
  return out;
}

/** Recognize font files by their signature, so a renamed photo can't hide behind ".woff2". */
export function isFontFile(bytes: Uint8Array): boolean {
  const head = ascii(bytes, 0, 4);
  return (
    head === 'wOFF' ||
    head === 'wOF2' ||
    head === 'OTTO' ||
    head === 'true' ||
    head === '\0\x01\0\0' ||
    ascii(bytes, 34, 2) === 'LP' // EOT
  );
}

/**
 * TIFF and HEIF data, whatever the file is called: their metadata can sit where this check
 * doesn't walk, so they must be converted to JPEG, PNG or WebP first. AVIF (also an ISO media
 * file) is left to sharp, which reads its EXIF and XMP.
 */
export function convertFirstKind(bytes: Uint8Array): string | null {
  const head = ascii(bytes, 0, 12);
  if (head.startsWith('II*\0') || head.startsWith('MM\0*')) return 'TIFF data';
  if (head.slice(4, 8) === 'ftyp' && !/^avi[fs]$/.test(head.slice(8, 12))) return 'HEIF/HEIC data';
  return null;
}

/** Binary containers this check can't look inside. */
export function unscannableKind(bytes: Uint8Array): string | null {
  const head = ascii(bytes, 0, 12);
  if (head.startsWith('%PDF')) return 'PDF';
  if (head.startsWith('PK\x03\x04')) return 'ZIP or office document';
  if (head.slice(4, 8) === 'ftyp') return 'MP4/MOV/HEIC media';
  if (head.startsWith('ID3')) return 'MP3 audio';
  if (head.startsWith('OggS')) return 'Ogg media';
  if (head.startsWith('RIFF') && head.slice(8, 12) !== 'WEBP') return 'RIFF media (WAV/AVI)';
  if (head.startsWith('\x1a\x45\xdf\xa3')) return 'Matroska/WebM media';
  if (head.startsWith('\x1f\x8b')) return 'gzip archive';
  if (head.startsWith('7z\xbc\xaf')) return '7-Zip archive';
  if (head.startsWith('Rar!')) return 'RAR archive';
  if (head.startsWith('\xd0\xcf\x11\xe0')) return 'old Office document';
  return null;
}

/**
 * Base64 images embedded in HTML, CSS, JS or SVG text. The payload starts right after the comma
 * (or on the next line) with at least 16 base64 characters, so prose that mentions
 * "data:image/png;base64," isn't read as one; MIME-style line wrapping (also as &#10; or &#13;)
 * is joined back together. Parameters such as ";name=photo.jpg" are allowed.
 */
export function findDataUriImages(
  text: string,
): Array<{ type: string; bytes: Uint8Array; index: number }> {
  const found: Array<{ type: string; bytes: Uint8Array; index: number }> = [];
  for (const m of text.matchAll(
    /data:image\/([a-z0-9.+-]+)(?:;[^;,\s"')]+)*;base64,(?:\r?\n[ \t]*)?([A-Za-z0-9+/]{16}(?:[A-Za-z0-9+/=]|\r?\n[ \t]*|&#(?:10|13|x0?[aAdD]);)*)/gi,
  )) {
    found.push({
      type: m[1]!.toLowerCase(),
      bytes: Buffer.from(m[2]!.replace(/\s+|&#(?:10|13|x0?[aAdD]);/g, ''), 'base64'),
      index: m.index ?? 0,
    });
  }
  return found;
}

/** The image format a file's first bytes announce, or null when they announce none. */
export function imageSignature(bytes: Uint8Array): string | null {
  const head = ascii(bytes, 0, 12);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (head.startsWith('\x89PNG')) return 'png';
  if (head.startsWith('GIF8')) return 'gif';
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'webp';
  if (convertFirstKind(bytes)) return 'tiff/heif';
  if (head.slice(4, 8) === 'ftyp') return 'avif';
  return null;
}
