// Photos embedded in a PDF keep their own metadata (D78). An image stream stored as a plain JPEG
// (/Filter /DCTDecode) holds the JPEG file's bytes as they were: EXIF with the camera, the time
// and sometimes GPS coordinates and a thumbnail, XMP, Photoshop/IPTC blocks and comments. These
// helpers find those streams without a PDF library, and blank the metadata in place: the file
// keeps its length, so nothing else in the PDF moves, and every page renders as before.

export interface PdfJpegBlock {
  /** What the segment holds. */
  kind: 'EXIF' | 'XMP' | 'APP1' | 'IPTC/Photoshop' | 'comment' | 'MPF';
  /** Offset of the segment's marker byte (the byte after 0xFF) in the file. */
  marker: number;
  /** The payload's byte range in the file. */
  start: number;
  end: number;
}

export interface PdfJpeg {
  /** Offset of the JPEG's first byte in the file. */
  start: number;
  blocks: PdfJpegBlock[];
}

export interface PdfImageScan {
  jpegs: PdfJpeg[];
  /** Image streams this scan cannot vouch for; a file with any of these fails the check. */
  unhandled: string[];
}

const latin1 = (bytes: Uint8Array, start = 0, end = bytes.length) =>
  Buffer.from(bytes.buffer, bytes.byteOffset + start, Math.max(0, end - start)).toString('latin1');

/** An image dictionary that stores its stream as a JPEG and nothing else. */
const PLAIN_JPEG = /\/Filter\s*(?:\/DCTDecode\b|\[\s*\/DCTDecode\s*\])/;
const ANY_JPEG = /\/(?:DCTDecode|DCT)\b/;
const JPEG_2000 = /\/JPXDecode\b/;
/** A blanked segment becomes an application segment that no reader gives a meaning to. */
const NEUTRAL_MARKER = 0xef;

function classify(marker: number, payload: Uint8Array): PdfJpegBlock['kind'] | null {
  const head = latin1(payload, 0, Math.min(payload.length, 64));
  if (marker === 0xe1) {
    if (head.startsWith('Exif\0\0')) return 'EXIF';
    if (head.startsWith('http://ns.adobe.com/x') || latin1(payload).includes('<x:xmpmeta'))
      return 'XMP';
    return 'APP1';
  }
  if (marker === 0xed) return 'IPTC/Photoshop';
  if (marker === 0xfe) return 'comment';
  if (marker === 0xe2 && head.startsWith('MPF\0')) return 'MPF';
  return null;
}

/** The metadata segments of the JPEG that starts at `start`, up to its image data. */
function jpegBlocks(bytes: Uint8Array, start: number): PdfJpegBlock[] {
  const blocks: PdfJpegBlock[] = [];
  let i = start + 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) break; // not a marker: this is not a JPEG header any more
    const marker = bytes[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // end of image, or start of the image data
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 2) break;
    const payloadStart = i + 4;
    const payloadEnd = Math.min(i + 2 + length, bytes.length);
    const kind = classify(marker, bytes.subarray(payloadStart, payloadEnd));
    // A segment blanked earlier is all zeros under the neutral marker: nothing left to report.
    if (kind) blocks.push({ kind, marker: i + 1, start: payloadStart, end: payloadEnd });
    i += 2 + length;
  }
  return blocks;
}

/**
 * Every image stream of a PDF that is stored as a JPEG, with its metadata segments.
 * Image streams sit in the file as their own objects ("12 0 obj << ... >> stream"), also in
 * PDFs that compress their other objects, so a scan for those dictionaries finds them all.
 */
export function scanPdfImages(bytes: Uint8Array): PdfImageScan {
  const text = latin1(bytes);
  const jpegs: PdfJpeg[] = [];
  const unhandled: string[] = [];
  const streams = />>\s*stream\r?\n/g;
  for (let match = streams.exec(text); match; match = streams.exec(text)) {
    const dictEnd = match.index;
    const dictStart = Math.max(text.lastIndexOf(' obj', dictEnd), dictEnd - 8192, 0);
    const dict = text.slice(dictStart, dictEnd);
    // Bytes inside a stream that happen to read ">> stream": the object's own stream began
    // earlier, and was handled there.
    if (/stream\r?\n/.test(dict)) continue;
    const dataStart = match.index + match[0].length;
    const isJpegData =
      bytes[dataStart] === 0xff && bytes[dataStart + 1] === 0xd8 && bytes[dataStart + 2] === 0xff;
    if (PLAIN_JPEG.test(dict)) {
      if (!isJpegData) {
        unhandled.push(`a JPEG image stream at byte ${dataStart} that does not start as a JPEG`);
        continue;
      }
      const dataEnd = text.indexOf('endstream', dataStart);
      // A second picture after the first one's end (a depth map, an original): not handled.
      if (
        latin1(bytes, dataStart, dataEnd < 0 ? bytes.length : dataEnd).includes('\xff\xd9\xff\xd8')
      )
        unhandled.push(`a JPEG image stream at byte ${dataStart} that holds more than one picture`);
      jpegs.push({ start: dataStart, blocks: jpegBlocks(bytes, dataStart) });
    } else if (ANY_JPEG.test(dict)) {
      unhandled.push(`a JPEG image stream at byte ${dataStart} behind another filter`);
    } else if (JPEG_2000.test(dict)) {
      unhandled.push(`a JPEG 2000 image stream at byte ${dataStart}`);
    }
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
  const text = latin1(bytes);
  const found: string[] = [];
  if (/Exif\0\0(?:MM\0\*|II\*\0)/.test(text)) found.push('EXIF');
  // A JPEG's XMP segment ends its namespace with a NUL; a PDF's own XMP packet does not.
  if (text.includes('http://ns.adobe.com/xap/1.0/\0')) found.push('XMP in an image');
  if (text.includes('Photoshop 3.0\x008BIM')) found.push('IPTC/Photoshop');
  return found;
}
