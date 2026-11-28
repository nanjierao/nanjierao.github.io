// Photos embedded in a PDF keep their own metadata (D78). An image stream stored as a plain JPEG
// (/Filter /DCTDecode) holds the JPEG file's bytes as they were: EXIF with the camera, the time
// and sometimes GPS coordinates and a thumbnail, XMP, Photoshop/IPTC blocks and comments. These
// helpers find those streams without a PDF library, and blank the metadata in place: the file
// keeps its length, so nothing else in the PDF moves, and every page renders as before.
//
// The scan fails closed. What it cannot vouch for is listed as "unhandled", and a file with
// anything unhandled fails `npm run check:privacy` until someone has looked at it: an encrypted
// file, an image stream it cannot walk or whose length does not add up, a picture followed by
// more data, JPEG data outside the image streams it found, a stream it cannot decode, an image
// that keeps XMP in a stream of its own, camera fields in a metadata stream, a display's details
// in a color profile it cannot blank, a file attachment, an application's private data, an author
// record outside the document information (a figure's own), an included figure's file name.
import { inflateSync } from 'node:zlib';

export interface PdfJpegBlock {
  /** What the range holds: EXIF, XMP, IPTC/Photoshop, comment, MPF, or the marker's name. */
  kind: string;
  /** Offset in the file of the marker byte to make neutral, or -1 when the segment keeps it. */
  marker: number;
  /** The byte range in the file that is blanked. */
  start: number;
  end: number;
}

export interface PdfJpeg {
  /** The byte range of the image's stream in the file. */
  start: number;
  end: number;
  blocks: PdfJpegBlock[];
}

export interface PdfImageScan {
  jpegs: PdfJpeg[];
  /** What this scan cannot vouch for; a file with any of these fails the check. */
  unhandled: string[];
}

const latin1 = (bytes: Uint8Array, start = 0, end = bytes.length) =>
  Buffer.from(bytes.buffer, bytes.byteOffset + start, Math.max(0, end - start)).toString('latin1');

const IS_IMAGE = /\/Subtype\s*\/Image\b/;
/** A blanked segment becomes an application segment that no reader gives a meaning to. */
const NEUTRAL_MARKER = 0xef;
/** No stream of a paper inflates to more than this; a larger one is not read. */
const MAX_INFLATED = 128 * 1024 * 1024;

/**
 * A display's color profile says which display it was measured on. Apple's profiles keep that in
 * two tags of their own: 'mmod' (make, model, serial number, date of manufacture) and 'ndin'
 * (the panel's native values). Profiles made from a display's EDID (colord, DisplayCAL) keep its
 * serial number and EDID hash in the standard 'meta' dictionary. No color engine reads these
 * tags, so their contents can be blanked and the profile converts colors exactly as before. The
 * profile's name and its calibration curves ('vcgt') stay: a color engine may read them, and
 * they identify no single display.
 */
const DISPLAY_TAGS = new Set(['mmod', 'ndin', 'meta']);
const DISPLAY_KIND = 'display details in a color profile';

interface DisplayDetails {
  /** Ranges in the profile that hold the details: each tag's data after its 8-byte head. */
  ranges: Array<[from: number, to: number]>;
  /** The profile has such tags, but where their data lies could not be settled. */
  unsure: boolean;
}

function displayDetails(profile: Uint8Array): DisplayDetails {
  if (profile.length < 132 || latin1(profile, 36, 40) !== 'acsp')
    return { ranges: [], unsure: false };
  const u32 = (at: number) =>
    Buffer.from(profile.buffer, profile.byteOffset + at, 4).readUInt32BE(0);
  const tags: Array<{ name: string; from: number; to: number }> = [];
  const count = u32(128);
  const tableEnd = 132 + count * 12;
  for (let i = 0; i < count; i++) {
    const at = 132 + i * 12;
    // A tag table that runs past the profile: not a profile this code can read.
    if (at + 12 > profile.length) return { ranges: [], unsure: true };
    tags.push({
      name: latin1(profile, at, at + 4),
      from: u32(at + 4),
      to: u32(at + 4) + u32(at + 8),
    });
  }
  const details: DisplayDetails = { ranges: [], unsure: false };
  for (const tag of tags) {
    if (!DISPLAY_TAGS.has(tag.name) || tag.to - tag.from <= 8) continue;
    // Tags may share their data. Shared with a tag a color engine reads, it stays as it is.
    const shared = tags.some(
      (other) => !DISPLAY_TAGS.has(other.name) && other.from < tag.to && tag.from < other.to,
    );
    // Data inside the header or the tag table is no legal layout: blanking it would change how
    // the profile reads.
    if (shared || tag.to > profile.length || tag.from < tableEnd) details.unsure = true;
    else if (profile.subarray(tag.from + 8, tag.to).some((byte) => byte !== 0))
      details.ranges.push([tag.from + 8, tag.to]);
  }
  return details;
}

interface Classified {
  /** Ranges of the payload to blank. A range that keeps its marker leaves the segment in use. */
  blank: Array<{ kind: string; from: number; to: number; keepMarker: boolean }>;
  /** Something in the segment that this code can neither blank nor vouch for. */
  note?: string | undefined;
}

const KEEP: Classified = { blank: [] };

/**
 * What a header segment holds that should go. Kept: what a decoder needs and what carries
 * nothing, which is the JFIF header (without a thumbnail), a color profile (without the details
 * of one display), Adobe's color-transform segment, and a segment this tool blanked earlier.
 * Every other application segment and every comment counts as metadata, also the kinds this
 * file has never heard of.
 */
function classify(marker: number, payload: Uint8Array): Classified {
  const head = latin1(payload, 0, Math.min(payload.length, 64));
  const whole = (kind: string): Classified => ({
    blank: [{ kind, from: 0, to: payload.length, keepMarker: false }],
  });
  const tail = (kind: string, from: number): Classified =>
    payload.subarray(from).some((byte) => byte !== 0)
      ? { blank: [{ kind, from, to: payload.length, keepMarker: true }] }
      : KEEP;
  if (marker === NEUTRAL_MARKER && payload.every((byte) => byte === 0)) return KEEP;
  // "JFIF\0", version, units and density: 12 bytes. Then a thumbnail's size and its pixels.
  if (marker === 0xe0 && head.startsWith('JFIF\0')) return tail('JFIF thumbnail', 12);
  // "Adobe", version, two flag words and the color transform: 12 bytes.
  if (marker === 0xee && head.startsWith('Adobe')) return tail('data after the Adobe segment', 12);
  if (marker === 0xe2 && head.startsWith('ICC_PROFILE\0')) {
    // A large profile spans segments. Only the first one starts as a profile does, with the
    // header and the tag table; for the others there is nothing to read here. A first segment
    // too short for the header and the tag count, or without the profile's signature, cannot
    // be vouched for.
    const first = payload[12] === 1;
    const profile = payload.subarray(14);
    const readable = profile.length >= 132 && latin1(profile, 36, 40) === 'acsp';
    const { ranges, unsure } = displayDetails(profile);
    return {
      blank: ranges.map(([from, to]) => ({
        kind: DISPLAY_KIND,
        from: 14 + from,
        to: 14 + to,
        keepMarker: true,
      })),
      note:
        unsure || (first && !readable)
          ? 'has a color profile with display details this tool cannot place'
          : undefined,
    };
  }
  if (marker === 0xe1) {
    if (head.startsWith('Exif\0\0')) return whole('EXIF');
    if (head.startsWith('http://ns.adobe.com/x') || latin1(payload).includes('<x:xmpmeta'))
      return whole('XMP');
  }
  if (marker === 0xed) return whole('IPTC/Photoshop');
  if (marker === 0xfe) return whole('comment');
  if (marker === 0xe2 && head.startsWith('MPF\0')) return whole('MPF');
  return whole(`APP${marker - 0xe0}`);
}

const isMetadataMarker = (marker: number) => (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;

/**
 * Segments a decoder reads: the frame headers (SOF0 to SOF15, except the three codes that are
 * not frames), Huffman and arithmetic-coding tables, quantization tables, the restart interval,
 * the scan header, and the number of lines. Any other kind could carry anything, and a decoder
 * skips it, so it is reported.
 */
const isDecoderMarker = (marker: number) =>
  (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc8) ||
  marker === 0xdb ||
  marker === 0xda ||
  marker === 0xdd ||
  marker === 0xdc;

interface JpegWalk {
  blocks: PdfJpegBlock[];
  notes: string[];
  /** Offset just after the end-of-image marker, when the walk reached it. */
  end?: number;
  problem?: string;
}

/**
 * Walk the JPEG that starts at `start` and must end by `limit` (the end of its stream): every
 * segment, the image data of every scan, up to the end-of-image marker. A segment that says it
 * is longer than what is left of the stream means a cut-off or damaged picture: nothing of it
 * is blanked, because its range would reach into the objects that follow.
 */
function walkJpeg(bytes: Uint8Array, start: number, limit: number): JpegWalk {
  const blocks: PdfJpegBlock[] = [];
  const notes: string[] = [];
  const stop = (problem: string): JpegWalk => ({ blocks: [], notes: [], problem });
  let i = start + 2;
  while (i + 2 <= limit) {
    if (bytes[i] !== 0xff) return stop('is not a JPEG all the way through');
    const marker = bytes[i + 1]!;
    if (marker === 0xff) {
      i++; // a fill byte
      continue;
    }
    if (marker === 0xd9) return { blocks, notes, end: i + 2 };
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 4 > limit) break;
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    const payloadStart = i + 4;
    const payloadEnd = i + 2 + length;
    if (length < 2) return stop('has a segment with an impossible length');
    if (payloadEnd > limit) return stop('has a segment that runs past the end of the stream');
    if (!isMetadataMarker(marker) && !isDecoderMarker(marker))
      notes.push(`has a segment of a kind this tool does not know (0x${marker.toString(16)})`);
    // The number of lines is two bytes; a longer segment holds something else.
    if (marker === 0xdc && length !== 4)
      notes.push('has a number-of-lines segment with more in it');
    if (isMetadataMarker(marker)) {
      const found = classify(marker, bytes.subarray(payloadStart, payloadEnd));
      for (const range of found.blank)
        blocks.push({
          kind: range.kind,
          marker: range.keepMarker ? -1 : i + 1,
          start: payloadStart + range.from,
          end: payloadStart + range.to,
        });
      if (found.note !== undefined) notes.push(found.note);
    }
    i = payloadEnd;
    if (marker === 0xda) {
      // The image data of a scan: 0xFF 0x00 and the restart markers belong to it.
      while (i + 1 < limit) {
        if (bytes[i] === 0xff) {
          const next = bytes[i + 1]!;
          if (next !== 0x00 && next !== 0xff && !(next >= 0xd0 && next <= 0xd7)) break;
        }
        i++;
      }
    }
  }
  return stop('has no end-of-image marker');
}

/** A run of bytes that reads as the start of a JPEG file: two well-formed segments in a row. */
function looksLikeJpeg(bytes: Uint8Array, at: number): boolean {
  let i = at + 2;
  for (let segment = 0; segment < 2; segment++) {
    if (bytes[i] !== 0xff) return false;
    const marker = bytes[i + 1]!;
    const known =
      (marker >= 0xe0 && marker <= 0xef) ||
      marker === 0xdb ||
      marker === 0xc4 ||
      marker === 0xfe ||
      marker === 0xdd ||
      (marker >= 0xc0 && marker <= 0xc2);
    if (!known) return false;
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 2 || i + 2 + length + 2 > bytes.length) return false;
    i += 2 + length;
  }
  return bytes[i] === 0xff;
}

/** Signs of photo metadata in a run of bytes, wherever they sit. */
function signatures(text: string): string[] {
  const found: string[] = [];
  if (/Exif\0\0(?:MM\0\*|II\*\0)/.test(text)) found.push('EXIF');
  // A JPEG's XMP segment ends its namespace with a NUL; a PDF's own XMP packet does not.
  if (text.includes('http://ns.adobe.com/xap/1.0/\0')) found.push('XMP in an image');
  if (text.includes('Photoshop 3.0\x008BIM')) found.push('IPTC/Photoshop');
  // The same blocks without their JPEG wrapper, as an application's private data keeps them: a
  // TIFF header whose first directory follows it (EXIF's own layout; a multi-picture index has
  // it too), and Photoshop's IPTC record.
  if (unwrapped(text, ['II*\0\x08\0\0\0', 'MM\0*\0\0\0\x08'], ['Exif\0\0', 'MPF\0']))
    found.push('TIFF/EXIF');
  if (unwrapped(text, ['8BIM\x04\x04'], ['Photoshop 3.0\0']) && !found.includes('IPTC/Photoshop'))
    found.push('IPTC/Photoshop');
  return found;
}

/** Whether one of `needles` occurs in `text` without one of `wrappers` right before it. */
function unwrapped(text: string, needles: string[], wrappers: string[]): boolean {
  for (const needle of needles)
    for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1))
      if (!wrappers.some((w) => at >= w.length && text.startsWith(w, at - w.length))) return true;
  return false;
}

/**
 * Camera, location and contact fields in an XMP packet. A packet has to declare the namespace
 * of every field it uses, as elements or as attributes, so the declarations are what to look for.
 */
const PHOTO_XMP =
  /xmlns:(?:exif|exifEX|tiff|aux|crs|photoshop|Iptc4xmpCore|Iptc4xmpExt)\s*=|GPS(?:Latitude|Longitude)/;
/** An inline image in a page's content that is stored as a JPEG. */
const INLINE_JPEG = /\/(?:DCT|DCTDecode)\b[^]{0,200}?\bID\s/;
/** A file attached to the PDF: the name tree, a file specification, or the file's own stream. */
const ATTACHMENT = /\/EmbeddedFiles?\b|\/Type\s*\/Filespec\b|\/EF\s*(?:<<|\d+\s+\d+\s+R)/;
/** An application's private data: a drawing program's own file, its thumbnails, its settings. */
const PRIVATE_DATA = /\/PieceInfo\b/;
/** What pdfTeX keeps of an included PDF figure: its file name (a path) and its information. */
const INCLUDED_FIGURE = /\/PTEX[._](?:FileName|InfoDict)\b/;
const AUTHOR = /\/Author\b/g;

/** A PDF name as it means: "#xx" escapes resolved, and a filter's short name made long. */
const FILTER_NAMES: Record<string, string> = {
  '/AHx': '/ASCIIHexDecode',
  '/A85': '/ASCII85Decode',
  '/LZW': '/LZWDecode',
  '/Fl': '/FlateDecode',
  '/RL': '/RunLengthDecode',
  '/CCF': '/CCITTFaxDecode',
  '/DCT': '/DCTDecode',
};
const filterName = (name: string) => {
  const plain = name.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  return FILTER_NAMES[plain] ?? plain;
};
/** The filters of a picture's pixels that hold nothing but the pixels. */
const PIXEL_FILTERS = new Set([
  '/FlateDecode',
  '/LZWDecode',
  '/RunLengthDecode',
  '/CCITTFaxDecode',
  '/JBIG2Decode',
  '/ASCII85Decode',
  '/ASCIIHexDecode',
]);

function asciiHex(text: string): Buffer {
  const digits = text.split('>')[0]!.replace(/\s+/g, '');
  if (/[^0-9a-fA-F]/.test(digits)) throw new Error('not ASCIIHex');
  return Buffer.from(digits.length % 2 ? `${digits}0` : digits, 'hex');
}

function ascii85(text: string): Buffer {
  const body = text.split('~>')[0]!.replace(/\s+/g, '').replace(/^<~/, '');
  const out: number[] = [];
  let group: number[] = [];
  const flush = (count: number) => {
    let value = 0;
    for (let k = 0; k < 5; k++) value = value * 85 + (group[k] ?? 84);
    out.push(
      ...[value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].slice(0, count),
    );
    group = [];
  };
  for (const char of body) {
    if (char === 'z' && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const digit = char.charCodeAt(0) - 33;
    if (digit < 0 || digit > 84) throw new Error('not ASCII85');
    group.push(digit);
    if (group.length === 5) flush(4);
  }
  if (group.length > 1) flush(group.length - 1);
  return Buffer.from(out);
}

/** A stream's contents after its filters, as text; null when a filter is not one of these. */
function decoded(bytes: Uint8Array, filters: string[]): string | null {
  let data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const filter of filters) {
    if (filter === '/FlateDecode') data = inflateSync(data, { maxOutputLength: MAX_INFLATED });
    else if (filter === '/ASCIIHexDecode') data = asciiHex(data.toString('latin1'));
    else if (filter === '/ASCII85Decode') data = ascii85(data.toString('latin1'));
    else return null;
  }
  return data.toString('latin1');
}

interface PdfStream {
  dict: string;
  filters: string[];
  start: number;
  end: number;
  /** Where the stream ends could not be settled from its length and the "endstream" word. */
  unsure: boolean;
}

/**
 * The streams of a PDF with their dictionaries, read from the file's own text: "12 0 obj << ...
 * >> stream ... endstream". Image streams are always objects of their own, also in PDFs that
 * compress their other objects. A stream ends where its /Length says, when "endstream" follows
 * there; without a number in the dictionary it ends at the next "endstream". Bytes inside a
 * stream that happen to read ">> stream" are skipped: the search goes on after the stream's end.
 */
function pdfStreams(text: string): PdfStream[] {
  const streams: PdfStream[] = [];
  const opener = />>\s*stream(?:\r\n|\n|\r(?!\n))/g;
  for (let match = opener.exec(text); match; match = opener.exec(text)) {
    const dictEnd = match.index + 2;
    const window = text.slice(Math.max(0, dictEnd - 8192), dictEnd);
    const object = window.lastIndexOf(' obj');
    const dict = object < 0 ? window : window.slice(object);
    const start = match.index + match[0].length;
    const keyword = text.indexOf('endstream', start);
    let end = keyword < 0 ? text.length : keyword;
    let unsure = keyword < 0;
    const length = /\/Length\s+(\d+)\b(?!\s+\d+\s+R\b)/.exec(dict);
    if (length) {
      const stated = start + Number(length[1]);
      if (/^(?:\r\n|\r|\n)?endstream/.test(text.slice(stated, stated + 11))) end = stated;
      else unsure = true;
    } else if (text.slice(start, end).includes('endobj')) unsure = true;
    const filter = /\/Filter\s*(\[[^\]]*\]|\/[^\s/[\]<>(){}%]+)/.exec(dict);
    streams.push({
      dict,
      filters: (filter?.[1]!.match(/\/[^\s/[\]<>(){}%]+/g) ?? []).map(filterName),
      start,
      end,
      unsure,
    });
    opener.lastIndex = Math.max(end, start);
  }
  return streams;
}

/**
 * Author records that are not the document's own: the document information dictionary (the one
 * a trailer names as /Info) may say who wrote the paper, and a reader shows it. An /Author key
 * anywhere else, such as in the record a drawing program leaves for each figure, names someone
 * the pages may not, and no reader shows it. Counted in the file's text and, for a PDF that
 * compresses its objects, in each object stream, by the object the key sits in.
 */
function authorsOutsideInfo(
  text: string,
  objectStreams: Array<{ dict: string; inside: string }>,
): number {
  const info = new Set([...text.matchAll(/\/Info\s+(\d+)\s+\d+\s+R\b/g)].map((m) => Number(m[1])));
  const starts = [...text.matchAll(/(?<![0-9])(\d+)\s+\d+\s+obj\b/g)].map((m) => ({
    at: m.index,
    id: Number(m[1]),
  }));
  let outside = 0;
  for (const { index } of text.matchAll(AUTHOR)) {
    let low = 0;
    let high = starts.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (starts[mid]!.at < index) {
        found = mid;
        low = mid + 1;
      } else high = mid - 1;
    }
    const object = found >= 0 ? starts[found]! : undefined;
    const inObject = object && !text.slice(object.at, index).includes('endobj');
    if (!inObject || !info.has(object.id)) outside++;
  }
  for (const { dict, inside } of objectStreams) {
    const first = Number(/\/First\s+(\d+)/.exec(dict)?.[1] ?? NaN);
    const header = inside
      .slice(0, Number.isFinite(first) ? first : 0)
      .trim()
      .split(/\s+/);
    const objects: Array<{ id: number; at: number }> = [];
    for (let i = 0; i + 1 < header.length; i += 2)
      objects.push({ id: Number(header[i]), at: first + Number(header[i + 1]) });
    for (const { index } of inside.matchAll(AUTHOR)) {
      const object = objects.filter((o) => o.at <= index).at(-1);
      if (!object || !info.has(object.id)) outside++;
    }
  }
  return outside;
}

/** Every image stream of a PDF that is stored as a JPEG, with its metadata segments. */
export function scanPdfImages(bytes: Uint8Array): PdfImageScan {
  const text = latin1(bytes);
  const jpegs: PdfJpeg[] = [];
  const unhandled: string[] = [];
  const covered: Array<[number, number]> = [];
  let attachment = ATTACHMENT.test(text);
  let privateData = PRIVATE_DATA.test(text);
  let includedFigure = INCLUDED_FIGURE.test(text);
  /** Decoded streams that hold objects; author records are looked for in them too. */
  const objectStreams: Array<{ dict: string; inside: string }> = [];
  /** Author keys in decoded streams that hold no objects (a page's inline property lists). */
  let authorsInContent = 0;
  if (/\/Encrypt\s*(?:<<|\d+\s+\d+\s+R)/.test(text))
    unhandled.push('an encrypted file, which this scan cannot read');
  for (const { dict, filters, start, end, unsure } of pdfStreams(text)) {
    const at = `at byte ${start}`;
    const image = IS_IMAGE.test(dict);
    if (filters.length === 1 && filters[0] === '/DCTDecode') {
      covered.push([start, end]);
      if (unsure) {
        unhandled.push(`a JPEG image stream ${at} whose length does not match where it ends`);
        continue;
      }
      if (!(bytes[start] === 0xff && bytes[start + 1] === 0xd8 && bytes[start + 2] === 0xff)) {
        unhandled.push(`a JPEG image stream ${at} that does not start as a JPEG`);
        continue;
      }
      const walk = walkJpeg(bytes, start, end);
      if (walk.problem !== undefined || walk.end === undefined) {
        unhandled.push(`a JPEG image stream ${at} that ${walk.problem ?? 'cannot be read'}`);
        continue;
      }
      for (const note of walk.notes) unhandled.push(`a JPEG image stream ${at} that ${note}`);
      // After the picture's end only the line break before "endstream" may follow. Anything
      // else is a second picture (a depth map, an original, a video) or a maker's trailer.
      if (/[^\r\n]/.test(text.slice(walk.end, end)))
        unhandled.push(`a JPEG image stream ${at} with more data after the picture's end`);
      jpegs.push({ start, end, blocks: walk.blocks });
    } else if (filters.includes('/DCTDecode')) {
      covered.push([start, end]);
      unhandled.push(`a JPEG image stream ${at} behind another filter`);
    } else if (filters.includes('/JPXDecode')) {
      unhandled.push(`a JPEG 2000 image stream ${at}`);
    } else if (/\/Filter\s+\d+\s+\d+\s+R\b/.test(dict)) {
      unhandled.push(`a stream ${at} whose filter is named in another object`);
    } else if (image) {
      // A picture's pixels: only filters that hold nothing else.
      const unknown = filters.filter((name) => !PIXEL_FILTERS.has(name));
      if (unknown.length > 0)
        unhandled.push(
          `an image stream ${at} with a filter this scan does not know (${unknown.join(' ')})`,
        );
    } else {
      // Everything that is not a picture's pixels: page content, object streams, metadata,
      // fonts, color profiles, attachments. Read it after its filters, or say that it could
      // not be read. (A cross-reference stream holds only offsets.)
      let inside: string | null;
      let why = filters.join(' ');
      try {
        inside = decoded(bytes.subarray(start, end), filters);
        if (/\/Predictor\s+(?:[2-9]|1\d)\b/.test(dict) && !/\/Type\s*\/XRef\b/.test(dict)) {
          inside = null;
          why = 'stored with a predictor';
        }
      } catch {
        inside = null;
      }
      if (inside === null) {
        unhandled.push(`a stream ${at} that this scan cannot read (${why})`);
      } else {
        if (filters.length > 0) {
          for (const kind of signatures(inside))
            unhandled.push(`${kind} inside a compressed stream ${at}`);
          // A whole picture inside, such as a drawing program's thumbnail or an original.
          const buffer = Buffer.from(inside, 'latin1');
          for (
            let i = inside.indexOf('\xff\xd8\xff');
            i >= 0;
            i = inside.indexOf('\xff\xd8\xff', i + 1)
          )
            if (looksLikeJpeg(buffer, i)) {
              unhandled.push(`JPEG data inside a compressed stream ${at}`);
              break;
            }
        }
        if (INLINE_JPEG.test(inside)) unhandled.push(`an inline JPEG image inside a stream ${at}`);
        if (PHOTO_XMP.test(inside))
          unhandled.push(
            /\/Type\s*\/Metadata\b/.test(dict)
              ? `a metadata stream ${at} with camera, location or contact fields`
              : `camera, location or contact fields in a stream ${at}`,
          );
        if (/\/Type\s*\/ObjStm\b/.test(dict)) {
          objectStreams.push({ dict, inside });
          if (ATTACHMENT.test(inside)) attachment = true;
          if (PRIVATE_DATA.test(inside)) privateData = true;
          if (INCLUDED_FIGURE.test(inside)) includedFigure = true;
        } else if (filters.length > 0) {
          // Raw streams are counted with the file's text below.
          authorsInContent += [...inside.matchAll(AUTHOR)].length;
        }
        // A color profile the PDF itself carries can describe one display, too.
        if (inside.startsWith('acsp', 36)) {
          const profile = displayDetails(Buffer.from(inside, 'latin1'));
          if (profile.unsure || profile.ranges.length > 0)
            unhandled.push(`a color profile ${at} with the details of one display`);
        }
      }
    }
    // XMP that the PDF keeps for an image, or for an included figure, in a stream of its own.
    if (/\/Metadata\s+\d+\s+\d+\s+R\b/.test(dict)) {
      if (image) unhandled.push(`an image ${at} with a metadata stream of its own`);
      else if (/\/Subtype\s*\/Form\b/.test(dict))
        unhandled.push(`a figure ${at} with a metadata stream of its own`);
    }
  }
  if (attachment) unhandled.push('a file attachment');
  if (privateData) unhandled.push('an application’s private data (/PieceInfo)');
  if (includedFigure) unhandled.push('an included figure’s file name or information (pdfTeX)');
  const authors = authorsOutsideInfo(text, objectStreams) + authorsInContent;
  if (authors > 0)
    unhandled.push(
      `${authors} author record${authors === 1 ? '' : 's'} outside the document information, such as a figure’s own`,
    );
  // JPEG data anywhere else in the file: an image stream the search above did not pair with a
  // dictionary. A thumbnail inside a photo's EXIF lies within that photo's stream.
  let next = 0;
  for (let at = text.indexOf('\xff\xd8\xff'); at >= 0; at = text.indexOf('\xff\xd8\xff', at + 1)) {
    while (next < covered.length && covered[next]![1] <= at) next++;
    if (next < covered.length && at >= covered[next]![0]) continue;
    if (looksLikeJpeg(bytes, at))
      unhandled.push(`JPEG data at byte ${at} outside the image streams this scan found`);
  }
  return { jpegs, unhandled };
}

/**
 * Blank every metadata range of the PDF's JPEG streams, in place. Each range becomes zeros, and
 * its segment's marker a neutral one, unless a decoder needs the segment: a JFIF header loses
 * only its thumbnail, a display's color profile only the tags that describe the display.
 * Decoders skip what is left as they did before. Returns what was blanked.
 */
export function blankPdfImageMetadata(bytes: Uint8Array): string[] {
  const done: string[] = [];
  scanPdfImages(bytes).jpegs.forEach((jpeg, index) => {
    for (const block of jpeg.blocks) {
      bytes.fill(0, block.start, block.end);
      if (block.marker >= 0) bytes[block.marker] = NEUTRAL_MARKER;
      done.push(`image ${index + 1}: ${block.kind}, ${block.end - block.start} bytes`);
    }
  });
  return done;
}

/** Signs of photo metadata anywhere in the file, as a backstop for what the scan above reads. */
export function pdfMetadataSignatures(bytes: Uint8Array): string[] {
  return signatures(latin1(bytes));
}

/**
 * Everything `check:privacy` reports for a PDF beyond "review this file": the kinds of photo
 * metadata still in it, and what the scan could not vouch for.
 */
export function pdfPhotoFindings(bytes: Uint8Array): { metadata: string[]; unhandled: string[] } {
  const scan = scanPdfImages(bytes);
  const metadata = new Set([
    ...scan.jpegs.flatMap((jpeg) => jpeg.blocks.map((block) => block.kind)),
    ...pdfMetadataSignatures(bytes),
  ]);
  return { metadata: [...metadata], unhandled: scan.unhandled };
}

/** A PDF by its bytes: readers accept the header a little after the file's start. */
export function isPdf(bytes: Uint8Array): boolean {
  return latin1(bytes, 0, Math.min(bytes.length, 1024)).includes('%PDF-');
}
