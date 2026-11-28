// Photos embedded in a PDF keep their own metadata (D78). An image stream stored as a plain JPEG
// (/Filter /DCTDecode) holds the JPEG file's bytes as they were: EXIF with the camera, the time
// and sometimes GPS coordinates and a thumbnail, XMP, Photoshop/IPTC blocks and comments. These
// helpers find those streams without a PDF library, and blank the metadata in place: the file
// keeps its length, so nothing else in the PDF moves, and every page renders as before.
//
// The scan fails closed. What it cannot vouch for is listed as "unhandled", and a file with
// anything unhandled fails `npm run check:privacy` until someone has looked at it: an image
// stream it cannot walk, JPEG data outside the image streams it found, a picture followed by
// more data, an image that keeps XMP in a stream of its own, a file attachment.
import { inflateSync } from 'node:zlib';

export interface PdfJpegBlock {
  /** What the segment holds: EXIF, XMP, IPTC/Photoshop, comment, MPF, or the marker's name. */
  kind: string;
  /** Offset of the segment's marker byte (the byte after 0xFF) in the file. */
  marker: number;
  /** The payload's byte range in the file. */
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

/** An image dictionary that stores its stream as a JPEG and nothing else. */
const PLAIN_JPEG = /\/Filter\s*(?:\/DCTDecode\b|\[\s*\/DCTDecode\s*\])/;
const ANY_JPEG = /\/(?:DCTDecode|DCT)\b/;
const JPEG_2000 = /\/JPXDecode\b/;
const IS_IMAGE = /\/Subtype\s*\/Image\b/;
/** A blanked segment becomes an application segment that no reader gives a meaning to. */
const NEUTRAL_MARKER = 0xef;

/**
 * What a header segment holds, or null for the ones a decoder needs or that carry nothing:
 * the JFIF header, the color profile, Adobe's color-transform segment, and a segment this tool
 * blanked earlier. Every other application segment and every comment counts as metadata, also
 * the kinds this file has never heard of.
 */
function classify(marker: number, payload: Uint8Array): string | null {
  const head = latin1(payload, 0, Math.min(payload.length, 64));
  if (marker === 0xe0 && head.startsWith('JFIF\0')) return null;
  if (marker === 0xe2 && head.startsWith('ICC_PROFILE\0')) return null;
  if (marker === 0xee && head.startsWith('Adobe')) return null;
  if (marker === NEUTRAL_MARKER && payload.every((byte) => byte === 0)) return null;
  if (marker === 0xe1) {
    if (head.startsWith('Exif\0\0')) return 'EXIF';
    if (head.startsWith('http://ns.adobe.com/x') || latin1(payload).includes('<x:xmpmeta'))
      return 'XMP';
  }
  if (marker === 0xed) return 'IPTC/Photoshop';
  if (marker === 0xfe) return 'comment';
  if (marker === 0xe2 && head.startsWith('MPF\0')) return 'MPF';
  return `APP${marker - 0xe0}`;
}

const isMetadataMarker = (marker: number) => (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;

interface JpegWalk {
  blocks: PdfJpegBlock[];
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
  let i = start + 2;
  while (i + 2 <= limit) {
    if (bytes[i] !== 0xff) return { blocks: [], problem: 'is not a JPEG all the way through' };
    const marker = bytes[i + 1]!;
    if (marker === 0xff) {
      i++; // a fill byte
      continue;
    }
    if (marker === 0xd9) return { blocks, end: i + 2 };
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 4 > limit) break;
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    const payloadStart = i + 4;
    const payloadEnd = i + 2 + length;
    if (length < 2 || payloadEnd > limit)
      return { blocks: [], problem: 'has a segment that runs past the end of the stream' };
    if (isMetadataMarker(marker)) {
      const kind = classify(marker, bytes.subarray(payloadStart, payloadEnd));
      if (kind) blocks.push({ kind, marker: i + 1, start: payloadStart, end: payloadEnd });
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
  return { blocks: [], problem: 'has no end-of-image marker' };
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
  return found;
}

/** Camera and location fields in an XMP packet: what a photo's metadata stream would hold. */
const PHOTO_XMP = /<(?:exif|exifEX|tiff|photoshop|Iptc4xmpCore|aux|crs):|GPS(?:Latitude|Longitude)/;

interface PdfStream {
  dict: string;
  start: number;
  end: number;
}

/**
 * The streams of a PDF with their dictionaries, read from the file's own text: "12 0 obj << ...
 * >> stream ... endstream". Image streams are always objects of their own, also in PDFs that
 * compress their other objects. Bytes inside a stream that happen to read ">> stream" are
 * skipped, because the search goes on after the stream's end.
 */
function pdfStreams(text: string): PdfStream[] {
  const streams: PdfStream[] = [];
  const opener = />>\s*stream(?:\r\n|\n|\r(?!\n))/g;
  for (let match = opener.exec(text); match; match = opener.exec(text)) {
    const dictEnd = match.index + 2;
    const dictStart = Math.max(text.lastIndexOf(' obj', dictEnd), dictEnd - 8192, 0);
    const start = match.index + match[0].length;
    const endstream = text.indexOf('endstream', start);
    const end = endstream < 0 ? text.length : endstream;
    streams.push({ dict: text.slice(dictStart, dictEnd), start, end });
    opener.lastIndex = end;
  }
  return streams;
}

/** Every image stream of a PDF that is stored as a JPEG, with its metadata segments. */
export function scanPdfImages(bytes: Uint8Array): PdfImageScan {
  const text = latin1(bytes);
  const jpegs: PdfJpeg[] = [];
  const unhandled: string[] = [];
  const covered: Array<[number, number]> = [];
  for (const { dict, start, end } of pdfStreams(text)) {
    const at = `at byte ${start}`;
    if (PLAIN_JPEG.test(dict)) {
      covered.push([start, end]);
      if (!(bytes[start] === 0xff && bytes[start + 1] === 0xd8 && bytes[start + 2] === 0xff)) {
        unhandled.push(`a JPEG image stream ${at} that does not start as a JPEG`);
        continue;
      }
      const walk = walkJpeg(bytes, start, end);
      if (walk.problem !== undefined || walk.end === undefined) {
        unhandled.push(`a JPEG image stream ${at} that ${walk.problem ?? 'cannot be read'}`);
        continue;
      }
      // After the picture's end only the line break before "endstream" may follow. Anything
      // else is a second picture (a depth map, an original, a video) or a maker's trailer.
      if (/[^\r\n]/.test(text.slice(walk.end, end)))
        unhandled.push(`a JPEG image stream ${at} with more data after the picture's end`);
      jpegs.push({ start, end, blocks: walk.blocks });
    } else if (ANY_JPEG.test(dict) && IS_IMAGE.test(dict)) {
      covered.push([start, end]);
      unhandled.push(`a JPEG image stream ${at} behind another filter`);
    } else if (JPEG_2000.test(dict)) {
      unhandled.push(`a JPEG 2000 image stream ${at}`);
    }
    // XMP that the PDF keeps for an image in a stream of its own.
    if (IS_IMAGE.test(dict) && /\/Metadata\b/.test(dict))
      unhandled.push(`an image ${at} with a metadata stream of its own`);
    if (/\/Type\s*\/Metadata\b/.test(dict) && PHOTO_XMP.test(text.slice(start, end)))
      unhandled.push(`a metadata stream ${at} with camera or location fields`);
    if (/\/Type\s*\/EmbeddedFile\b/.test(dict)) unhandled.push(`a file attachment ${at}`);
    // What sits inside a compressed stream: photo metadata, or an inline JPEG.
    if (/\/Filter\s*(?:\/FlateDecode\b|\[\s*\/FlateDecode\s*\])/.test(dict)) {
      let inflated = '';
      try {
        inflated = inflateSync(bytes.subarray(start, end)).toString('latin1');
      } catch {
        // Not readable as plain deflate (a predictor, an encrypted file): nothing to search.
      }
      for (const kind of signatures(inflated))
        unhandled.push(`${kind} inside a compressed stream ${at}`);
      if (/\/(?:DCT|DCTDecode)\b[^]{0,200}?\bID\s/.test(inflated))
        unhandled.push(`an inline JPEG image inside a compressed stream ${at}`);
    }
  }
  // JPEG data anywhere else in the file: an image stream the search above did not pair with a
  // dictionary. A thumbnail inside a photo's EXIF lies within that photo's stream.
  for (let at = text.indexOf('\xff\xd8\xff'); at >= 0; at = text.indexOf('\xff\xd8\xff', at + 1)) {
    if (covered.some(([start, end]) => at >= start && at < end)) continue;
    if (looksLikeJpeg(bytes, at))
      unhandled.push(`JPEG data at byte ${at} outside the image streams this scan found`);
  }
  return { jpegs, unhandled };
}

/**
 * Blank every metadata segment of the PDF's JPEG streams, in place. Each payload becomes zeros
 * and its marker a neutral one, so decoders skip it as they did before. Returns what was blanked.
 */
export function blankPdfImageMetadata(bytes: Uint8Array): string[] {
  const done: string[] = [];
  scanPdfImages(bytes).jpegs.forEach((jpeg, index) => {
    for (const block of jpeg.blocks) {
      bytes.fill(0, block.start, block.end);
      bytes[block.marker] = NEUTRAL_MARKER;
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
