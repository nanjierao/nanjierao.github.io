// Photo metadata inside PDFs (D78): scripts/lib/pdf-images.ts finds the JPEG image streams of a
// PDF and blanks their metadata segments in place, and lists whatever it cannot vouch for. The
// files here are built in the test: a few PDF objects around JPEG data, with made-up values.
import { deflateSync } from 'node:zlib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { readImageMetadata } from '../../scripts/lib/image-metadata.ts';
import {
  blankPdfImageMetadata,
  isPdf,
  pdfMetadataSignatures,
  pdfPhotoFindings,
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
const TABLE = segment(0xdb, '\0' + '\x10'.repeat(64));
// The image data of a scan, with a stuffed 0xFF and a restart marker inside it.
const SCAN = '\xff\xda\0\x08\x01\x01\0\0\x3f\0' + '\x12\x34\xff\0\x56\xff\xd0\x78'.repeat(8);
const END = '\xff\xd9';

const jpeg = (...segments: string[]) => `\xff\xd8${JFIF}${segments.join('')}${TABLE}${SCAN}${END}`;

type Layout = (dict: string, data: string) => string;
const LAYOUTS: Record<string, Layout> = {
  'newline, stream, newline': (dict, data) => `${dict}\nstream\n${data}\nendstream`,
  'stream right after the dictionary, CR LF': (dict, data) =>
    `${dict}stream\r\n${data}\r\nendstream`,
  'CR, stream, LF': (dict, data) => `${dict}\rstream\n${data}\rendstream`,
};

function pdf(...objects: string[]): Uint8Array {
  return bytesOf(
    `%PDF-1.5\n%\xe2\xe3\xcf\xd3\n${objects.map((body, i) => `${i + 1} 0 obj\n${body}\nendobj\n`).join('')}trailer\n<< /Size ${objects.length + 1} >>\n%%EOF\n`,
  );
}

const imageDict = (length: number, filter = '/DCTDecode', extra = '') =>
  `<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${filter} /Length ${length}${extra} >>`;
const image = (data: string, filter?: string, extra?: string) =>
  LAYOUTS['newline, stream, newline']!(imageDict(data.length, filter, extra), data);

const page = '<< /Type /Page /Contents 3 0 R >>';
const content = `<< /Length 21 >>\nstream\nq 4 0 0 4 0 0 cm /Im1 Do Q\nendstream`;

describe('photo metadata inside a PDF (D78)', () => {
  const withMetadata = jpeg(EXIF, XMP, PHOTOSHOP, COMMENT, ICC, ADOBE);
  const clean = jpeg(ICC, ADOBE);

  for (const [name, layout] of Object.entries(LAYOUTS))
    it(`finds each JPEG image stream and its metadata segments (${name})`, () => {
      const file = pdf(
        page,
        layout(imageDict(withMetadata.length), withMetadata),
        content,
        layout(imageDict(clean.length, '[ /DCTDecode ]'), clean),
      );
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
      expect(pdfPhotoFindings(file).metadata).toEqual([
        'EXIF',
        'XMP',
        'IPTC/Photoshop',
        'comment',
        'XMP in an image',
      ]);
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
    for (const kept of [
      ICC,
      ADOBE,
      TABLE,
      SCAN,
      JFIF,
      page,
      content,
      '/Filter /DCTDecode',
      '%%EOF',
    ])
      expect(text).toContain(kept);
    // Only the blanked payloads and their four marker bytes differ, and each marker is now the
    // neutral one.
    const changed = [...file.keys()].filter((i) => file[i] !== before[i]);
    const payload = EXIF.length + XMP.length + PHOTOSHOP.length + COMMENT.length - 4 * 4;
    expect(changed.length).toBeLessThanOrEqual(payload + 4);
    expect(changed.length).toBeGreaterThan(payload / 2);
    for (const block of scanPdfImages(before).jpegs[0]!.blocks) {
      expect(file[block.marker]).toBe(0xef);
      expect(file.subarray(block.start, block.end).every((byte) => byte === 0)).toBe(true);
    }

    const after = scanPdfImages(file);
    expect(after.unhandled).toEqual([]);
    expect(after.jpegs).toHaveLength(1);
    expect(after.jpegs[0]!.blocks).toEqual([]);
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
    // Running it again changes nothing.
    const again = file.slice();
    expect(blankPdfImageMetadata(again)).toEqual([]);
    expect(textOf(again)).toBe(text);
    // The image itself, taken out of the PDF, now passes the check that images get.
    const { start, end } = after.jpegs[0]!;
    const picture = readImageMetadata(file.subarray(start, end));
    expect(picture.blocks).toEqual([]);
    expect(picture.texts.join('').replace(/\0/g, '')).toBe('');
  });

  it('treats every application segment it does not need as metadata, wherever it sits', () => {
    // Content credentials (APP11), a maker's block (APP6), a second thumbnail header (JFXX), a
    // multi-picture index, an APP1 that is neither EXIF nor XMP: all after the color profile,
    // with fill bytes in between.
    const others =
      ICC +
      '\xff\xff' +
      segment(0xeb, 'JP\0\x01 made-up credentials: Sample Person') +
      segment(0xe6, 'GoPro\0sample') +
      segment(0xe0, 'JFXX\0\x10thumbnail') +
      segment(0xe2, 'MPF\0II*\0sample') +
      segment(0xe1, 'a maker note: Sample Person');
    const file = pdf(image(jpeg(others)));
    const scan = scanPdfImages(file);
    expect(scan.unhandled).toEqual([]);
    expect(scan.jpegs[0]!.blocks.map((block) => block.kind)).toEqual([
      'APP11',
      'APP6',
      'APP0',
      'MPF',
      'APP1',
    ]);
    blankPdfImageMetadata(file);
    expect(textOf(file)).not.toContain('Sample Person');
    expect(textOf(file)).toContain(ICC);
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
  });

  it('finds a comment between the scans of a progressive picture', () => {
    const progressive = `\xff\xd8${JFIF}${TABLE}${SCAN}${COMMENT}${SCAN}${END}`;
    const file = pdf(image(progressive));
    expect(scanPdfImages(file).jpegs[0]!.blocks.map((block) => block.kind)).toEqual(['comment']);
    blankPdfImageMetadata(file);
    expect(textOf(file)).not.toContain('sample tool');
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
  });

  it('never writes outside a damaged picture: a segment that runs past its stream is left alone', () => {
    // The EXIF segment claims 0x4000 bytes; the stream ends long before that.
    const cut = `\xff\xd8${JFIF}\xff\xe1\x40\0Exif\0\0II*\0\x08\0\0\0 MADE-UP-GPS`;
    const next = '<< /Producer (the object after the picture) >>';
    const file = pdf(image(cut), next, content);
    const before = textOf(file);
    const scan = scanPdfImages(file);
    expect(scan.jpegs).toEqual([]);
    expect(scan.unhandled).toHaveLength(1);
    expect(scan.unhandled[0]).toMatch(/has a segment that runs past the end of the stream/);
    expect(blankPdfImageMetadata(file)).toEqual([]);
    expect(textOf(file)).toBe(before);
    // The backstop still reports the EXIF it could not remove.
    expect(pdfPhotoFindings(file).metadata).toEqual(['EXIF']);
  });

  it('reports what it cannot vouch for', () => {
    const two = `${jpeg(EXIF)}${jpeg()}`;
    const trailer = `${jpeg()}SEFT made-up trailer`;
    const noEnd = `\xff\xd8${JFIF}${TABLE}${SCAN}`;
    const cases: Array<[stream: string, problem: RegExp]> = [
      [image('x\x9c\x01\x02\x03', '[ /FlateDecode /DCTDecode ]'), /behind another filter/],
      [image('\0\0\0\x0cjP  \r\n\x87\n', '/JPXDecode'), /JPEG 2000/],
      [image('not a jpeg at all'), /does not start as a JPEG/],
      [image(two), /more data after the picture's end/],
      [image(trailer), /more data after the picture's end/],
      [image(noEnd), /has no end-of-image marker/],
      [
        image(clean, '/DCTDecode', ' /Metadata 9 0 R'),
        /an image .* with a metadata stream of its own/,
      ],
      [
        `<< /Type /Metadata /Subtype /XML /Length 90 >>\nstream\n<x:xmpmeta><exif:GPSLatitude>12,34.5N</exif:GPSLatitude></x:xmpmeta>\nendstream`,
        /a metadata stream .* with camera or location fields/,
      ],
      [`<< /Type /EmbeddedFile /Length 5 >>\nstream\nhello\nendstream`, /a file attachment/],
    ];
    for (const [stream, problem] of cases) {
      const scan = scanPdfImages(pdf(page, stream, content));
      expect(scan.unhandled, String(problem)).toHaveLength(1);
      expect(scan.unhandled[0]).toMatch(problem);
    }
  });

  it('finds a JPEG that no image dictionary announces, and metadata inside a compressed stream', () => {
    // A whole JPEG in a stream whose dictionary does not say what it is.
    const stray = `<< /Length ${withMetadata.length} >>\nstream\n${withMetadata}\nendstream`;
    const hidden = scanPdfImages(pdf(page, stray));
    expect(hidden.jpegs).toEqual([]);
    expect(hidden.unhandled).toHaveLength(1);
    expect(hidden.unhandled[0]).toMatch(/JPEG data at byte \d+ outside the image streams/);

    const packed = deflateSync(Buffer.from(`q BI /W 4 /H 4 /F /DCT ID ${EXIF} EI Q`, 'latin1'));
    const compressed = `<< /Length ${packed.length} /Filter /FlateDecode >>\nstream\n${packed.toString('latin1')}\nendstream`;
    const scan = scanPdfImages(pdf(page, compressed));
    expect(scan.unhandled.map((line) => line.replace(/ at byte \d+/, ''))).toEqual([
      'EXIF inside a compressed stream',
      'an inline JPEG image inside a compressed stream',
    ]);
    // The raw bytes show nothing, so only the scan finds it.
    expect(pdfMetadataSignatures(pdf(page, compressed))).toEqual([]);
  });

  it('leaves other streams alone, even when their bytes say "stream"', () => {
    const tricky = jpeg(`${segment(0xe2, 'ICC_PROFILE\0\x01\x01 x >>\nstream\n')}`, EXIF);
    const other = `<< /Length 24 >>\nstream\nBT (>> stream\n) Tj ET ok\nendstream`;
    const file = pdf(other, image(tricky), content);
    const before = textOf(file);
    const scan = scanPdfImages(file);
    expect(scan.unhandled).toEqual([]);
    expect(scan.jpegs).toHaveLength(1);
    expect(scan.jpegs[0]!.blocks.map((block) => block.kind)).toEqual(['EXIF']);
    blankPdfImageMetadata(file);
    const after = textOf(file);
    expect(after).toContain(other);
    expect(after).toContain(content);
    expect(after.length).toBe(before.length);
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
  });

  it('does not take a PDF’s own XMP packet for a photo’s', () => {
    const packet =
      '<< /Type /Metadata /Subtype /XML /Length 120 >>\nstream\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:Description xmlns:xap="http://ns.adobe.com/xap/1.0/"/></x:xmpmeta>\nendstream';
    const file = pdf(packet, image(clean));
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
  });

  it('keeps a real photo’s pixels: the picture decodes to the same image after blanking', async () => {
    const photo = await sharp({
      create: { width: 24, height: 16, channels: 3, background: { r: 200, g: 120, b: 40 } },
    })
      .jpeg({ quality: 80 })
      .withExif({ IFD0: { Artist: 'Sample Person', Copyright: 'made-up' } })
      .toBuffer();
    expect(readImageMetadata(photo).blocks).toContain('EXIF');
    const file = pdf(page, image(photo.toString('latin1')), content);
    const [found] = scanPdfImages(file).jpegs;
    expect(found!.blocks.map((block) => block.kind)).toContain('EXIF');
    const pixels = (bytes: Uint8Array) => sharp(Buffer.from(bytes)).raw().toBuffer();
    const before = await pixels(file.subarray(found!.start, found!.end));
    blankPdfImageMetadata(file);
    const after = await pixels(file.subarray(found!.start, found!.end));
    expect(after.equals(before)).toBe(true);
    expect(textOf(file)).not.toContain('Sample Person');
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
  });

  it('knows a PDF by its header, also a little after the start of the file', () => {
    expect(isPdf(pdf(page))).toBe(true);
    expect(isPdf(bytesOf(`\n\n%PDF-1.4\n`))).toBe(true);
    expect(isPdf(bytesOf('Not a PDF, just text.'))).toBe(false);
  });
});
