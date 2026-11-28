// Photo metadata inside PDFs (D78): scripts/lib/pdf-images.ts finds the JPEG image streams of a
// PDF and blanks their EXIF, XMP, Photoshop and comment segments in place. The files here are
// built in the test: a few PDF objects around hand-made JPEG headers, with made-up values.
import { describe, expect, it } from 'vitest';
import { readImageMetadata } from '../../scripts/lib/image-metadata.ts';
import {
  blankPdfImageMetadata,
  pdfMetadataSignatures,
  scanPdfImages,
} from '../../scripts/lib/pdf-images.ts';

const bytesOf = (text: string) => Uint8Array.from(Buffer.from(text, 'latin1'));
const textOf = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

/** One JPEG segment: marker, two length bytes, payload. */
function segment(marker: number, payload: string): string {
  const length = payload.length + 2;
  return `\xff${String.fromCharCode(marker)}${String.fromCharCode(length >> 8, length & 0xff)}${payload}`;
}

const JFIF = segment(0xe0, 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0');
// A TIFF header and a made-up GPS-looking tail: enough for the detectors to call it EXIF.
const EXIF = segment(0xe1, 'Exif\0\0II*\0\x08\0\0\0' + 'MADE-UP-GPS 12.345N 67.890W '.repeat(4));
const XMP = segment(
  0xe1,
  'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><dc:creator>Sample Person</dc:creator></x:xmpmeta>',
);
const PHOTOSHOP = segment(0xed, 'Photoshop 3.0\x008BIM\x04\x04\0\0\0\0\0\x05sample');
const COMMENT = segment(0xfe, 'made with a sample tool');
const ICC = segment(0xe2, 'ICC_PROFILE\0\x01\x01' + 'profile-bytes');
const ADOBE = segment(0xee, 'Adobe\0d\0\0\0\0\x01');
const SCAN = '\xff\xda\0\x08\x01\x01\0\0\x3f\0' + '\x12\x34\x56\x78'.repeat(8) + '\xff\xd9';

const jpeg = (...segments: string[]) => `\xff\xd8${JFIF}${segments.join('')}${SCAN}`;

function pdf(...objects: string[]): Uint8Array {
  return bytesOf(
    `%PDF-1.5\n%\xe2\xe3\xcf\xd3\n${objects.map((body, i) => `${i + 1} 0 obj\n${body}\nendobj\n`).join('')}trailer\n<< /Size ${objects.length + 1} >>\n%%EOF\n`,
  );
}

const image = (data: string, filter = '/DCTDecode') =>
  `<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${filter} /Length ${data.length} >>\nstream\n${data}\nendstream`;

describe('photo metadata inside a PDF (D78)', () => {
  const withMetadata = jpeg(EXIF, XMP, PHOTOSHOP, COMMENT, ICC, ADOBE);
  const clean = jpeg(ICC, ADOBE);
  const page = '<< /Type /Page /Contents 3 0 R >>';
  const content = `<< /Length 21 >>\nstream\nq 4 0 0 4 0 0 cm /Im1 Do Q\nendstream`;

  it('finds each JPEG image stream and its metadata segments', () => {
    const file = pdf(page, image(withMetadata), content, image(clean, '[ /DCTDecode ]'));
    const scan = scanPdfImages(file);
    expect(scan.unhandled).toEqual([]);
    expect(scan.jpegs).toHaveLength(2);
    expect(scan.jpegs[0]!.blocks.map((block) => block.kind)).toEqual([
      'EXIF',
      'XMP',
      'IPTC/Photoshop',
      'comment',
    ]);
    expect(scan.jpegs[1]!.blocks).toEqual([]);
    // Each block's range is the payload, as the file holds it.
    const exif = scan.jpegs[0]!.blocks[0]!;
    expect(textOf(file.subarray(exif.start, exif.start + 6))).toBe('Exif\0\0');
    expect(file[exif.marker]).toBe(0xe1);
    expect(pdfMetadataSignatures(file)).toEqual(['EXIF', 'XMP in an image', 'IPTC/Photoshop']);
  });

  it('blanks them in place: same length, same picture data, nothing left to find', () => {
    const file = pdf(page, image(withMetadata), content);
    const before = file.slice();
    const done = blankPdfImageMetadata(file);
    expect(done.map((line) => line.replace(/, \d+ bytes$/, ''))).toEqual([
      'image 1: EXIF',
      'image 1: XMP',
      'image 1: IPTC/Photoshop',
      'image 1: comment',
    ]);
    expect(file.length).toBe(before.length);
    const text = textOf(file);
    for (const gone of [
      'Exif',
      'MADE-UP-GPS',
      'Sample Person',
      'xmpmeta',
      'Photoshop',
      '8BIM',
      'sample tool',
    ])
      expect(text, gone).not.toContain(gone);
    // The color profile, the Adobe segment, the picture data and the PDF around it are untouched.
    for (const kept of [ICC, ADOBE, SCAN, JFIF, page, content, '/Filter /DCTDecode', '%%EOF'])
      expect(text).toContain(kept);
    // Only the blanked payloads and their four marker bytes differ.
    const changed = [...file.keys()].filter((i) => file[i] !== before[i]);
    const payload = EXIF.length + XMP.length + PHOTOSHOP.length + COMMENT.length - 4 * 4;
    expect(changed.length).toBeLessThanOrEqual(payload + 4);
    expect(changed.length).toBeGreaterThan(payload / 2);

    const after = scanPdfImages(file);
    expect(after.jpegs).toHaveLength(1);
    expect(after.jpegs[0]!.blocks).toEqual([]);
    expect(pdfMetadataSignatures(file)).toEqual([]);
    // Running it again changes nothing.
    const again = file.slice();
    expect(blankPdfImageMetadata(again)).toEqual([]);
    expect(textOf(again)).toBe(text);
    // The image itself, taken out of the PDF, now passes the check that images get.
    const start = after.jpegs[0]!.start;
    const end = text.indexOf('\nendstream', start);
    const picture = readImageMetadata(file.subarray(start, end));
    expect(picture.blocks).toEqual([]);
    expect(picture.texts).toEqual([]);
  });

  it('reports image streams it cannot vouch for', () => {
    const two = `${jpeg(EXIF)}${jpeg()}`;
    const scan = scanPdfImages(
      pdf(
        image('x\x9c\x01\x02\x03', '[ /FlateDecode /DCTDecode ]'),
        image('\0\0\0\x0cjP  \r\n\x87\n', '/JPXDecode'),
        image('not a jpeg at all'),
        image(two),
      ),
    );
    expect(scan.unhandled).toHaveLength(4);
    expect(scan.unhandled[0]).toMatch(/behind another filter/);
    expect(scan.unhandled[1]).toMatch(/JPEG 2000/);
    expect(scan.unhandled[2]).toMatch(/does not start as a JPEG/);
    expect(scan.unhandled[3]).toMatch(/more than one picture/);
  });

  it('leaves other streams alone, even when their bytes look like a JPEG or say "stream"', () => {
    const lookalike = `\xff\xd8${EXIF}${SCAN}`;
    const other = `<< /Length ${lookalike.length} /Filter /FlateDecode >>\nstream\n${lookalike}\nendstream`;
    const tricky = jpeg(`${segment(0xe0, 'x >>\nstream\n')}`, EXIF);
    const file = pdf(other, image(tricky));
    const before = textOf(file);
    const scan = scanPdfImages(file);
    expect(scan.unhandled).toEqual([]);
    expect(scan.jpegs).toHaveLength(1);
    expect(scan.jpegs[0]!.blocks.map((block) => block.kind)).toEqual(['EXIF']);
    blankPdfImageMetadata(file);
    const after = textOf(file);
    // The non-image stream keeps its bytes; only the image's EXIF is gone.
    expect(after).toContain(other);
    expect(after.length).toBe(before.length);
    expect(scanPdfImages(file).jpegs[0]!.blocks).toEqual([]);
    // The backstop still sees the EXIF-looking bytes in the other stream: such a file fails the
    // check until someone looks at it.
    expect(pdfMetadataSignatures(file)).toEqual(['EXIF']);
  });

  it('does not take a PDF’s own XMP packet for a photo’s', () => {
    const packet =
      '<< /Type /Metadata /Subtype /XML /Length 120 >>\nstream\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:Description xmlns:xap="http://ns.adobe.com/xap/1.0/"/></x:xmpmeta>\nendstream';
    const file = pdf(packet, image(clean));
    expect(pdfMetadataSignatures(file)).toEqual([]);
    expect(scanPdfImages(file).jpegs[0]!.blocks).toEqual([]);
  });
});
