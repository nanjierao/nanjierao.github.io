// Photo metadata inside PDFs (D78): scripts/lib/pdf-images.ts finds the JPEG image streams of a
// PDF and blanks their metadata in place, and lists whatever it cannot vouch for. The files here
// are built in the test: a few PDF objects around JPEG data, with made-up values.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
// A color profile in one segment: a header, a tag table and one tag a color engine reads.
const ICC = segment(
  0xe2,
  'ICC_PROFILE\0\x01\x01' + profile([['rXYZ', 'XYZ \0\0\0\0primaries...']]),
);
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
  'stream, then a CR alone': (dict, data) => `${dict}\nstream\r${data}\nendstream`,
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
/** Any other stream: its dictionary's entries, then the data. */
const stream = (entries: string, data: string) =>
  `<< ${entries} /Length ${data.length} >>\nstream\n${data}\nendstream`;
const flate = (text: string) => deflateSync(Buffer.from(text, 'latin1')).toString('latin1');

const page = '<< /Type /Page /Contents 3 0 R >>';
const content = `<< /Length 26 >>\nstream\nq 4 0 0 4 0 0 cm /Im1 Do Q\nendstream`;

/** What the scan cannot vouch for, without the byte offsets. */
const problems = (file: Uint8Array) =>
  scanPdfImages(file).unhandled.map((line) => line.replace(/ at byte \d+/, ''));

/** ASCII85 as PDF writes it. */
function ascii85(text: string): string {
  const bytes = Buffer.from(text, 'latin1');
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.subarray(i, i + 4);
    let value = 0;
    for (let k = 0; k < 4; k++) value = value * 256 + (chunk[k] ?? 0);
    let group = '';
    for (let k = 0; k < 5; k++) {
      group = String.fromCharCode(33 + (value % 85)) + group;
      value = Math.floor(value / 85);
    }
    out += group.slice(0, chunk.length + 1);
  }
  return `${out}~>`;
}

/**
 * A color profile as its bytes lay it out: a 128-byte header, the tag table, the tags' data.
 * A tag given `sharedWith` points at another tag's data, as real profiles do for equal curves.
 */
function profile(tags: Array<[name: string, data: string, sharedWith?: string]>): string {
  const head = Buffer.alloc(128);
  head.write('acsp', 36, 'latin1');
  const table = Buffer.alloc(4 + tags.length * 12);
  table.writeUInt32BE(tags.length, 0);
  const offsets = new Map<string, number>();
  let offset = head.length + table.length;
  let body = '';
  tags.forEach(([name, data, sharedWith], i) => {
    const at = sharedWith === undefined ? offset : offsets.get(sharedWith)!;
    offsets.set(name, at);
    table.write(name, 4 + i * 12, 'latin1');
    table.writeUInt32BE(at, 8 + i * 12);
    table.writeUInt32BE(data.length, 12 + i * 12);
    if (sharedWith === undefined) {
      body += data;
      offset += data.length;
    }
  });
  const whole = Buffer.concat([head, table, Buffer.from(body, 'latin1')]);
  whole.writeUInt32BE(whole.length, 0);
  return whole.toString('latin1');
}

const DISPLAY = 'display details in a color profile';
const XYZ = 'XYZ \0\0\0\0primaries...';
const CURVE = 'vcgt\0\0\0\0calibration.';
const MMOD = 'mmod\0\0\0\0MADE-UP SERIAL 0123456789 ABCDEF';
const NDIN = 'ndin\0\0\0\0made-up native panel values';
const iccSegment = (icc: string, chunk = '\x01\x01') =>
  segment(0xe2, `ICC_PROFILE\0${chunk}${icc}`);

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
      // Each stream is the picture, from its first byte to its end-of-image marker.
      for (const found of scan.jpegs) {
        expect(textOf(file.subarray(found.start, found.start + 3))).toBe('\xff\xd8\xff');
        expect(textOf(file.subarray(found.end - 2, found.end))).toBe(END);
      }
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

  it('reads a dictionary written without spaces', () => {
    const dict = `<</Type/XObject/Subtype/Image/Width 4/Height 4/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${withMetadata.length}>>`;
    const file = pdf(page, `${dict}stream\n${withMetadata}\nendstream`, content);
    const scan = scanPdfImages(file);
    expect(scan.unhandled).toEqual([]);
    expect(scan.jpegs).toHaveLength(1);
    expect(scan.jpegs[0]!.blocks).toHaveLength(4);
    blankPdfImageMetadata(file);
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
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

  it('takes a thumbnail out of the JFIF header and extra data out of Adobe’s segment, and keeps both segments', () => {
    const header = 'JFIF\0\x01\x01\0\0\x01\0\x01';
    const thumbnail = '\x02\x02made-up-rgb';
    const adobe = 'Adobe\0d\0\0\0\0\x01';
    const picture = `\xff\xd8${segment(0xe0, header + thumbnail)}${segment(0xee, `${adobe}made-up tail`)}${TABLE}${SCAN}${END}`;
    const file = pdf(page, image(picture), content);
    const [found] = scanPdfImages(file).jpegs;
    expect(found!.blocks.map((block) => block.kind)).toEqual([
      'JFIF thumbnail',
      'data after the Adobe segment',
    ]);
    // Neither segment gives up its marker: a decoder still reads the header in front.
    expect(found!.blocks.map((block) => block.marker)).toEqual([-1, -1]);
    const before = textOf(file);
    blankPdfImageMetadata(file);
    const after = textOf(file);
    expect(after).toContain(segment(0xe0, header + '\0'.repeat(thumbnail.length)));
    expect(after).toContain(segment(0xee, adobe + '\0'.repeat('made-up tail'.length)));
    expect(after).not.toContain('made-up');
    expect([...after].filter((char, i) => char !== before[i])).toHaveLength(
      thumbnail.length + 'made-up tail'.length,
    );
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
  });

  it('blanks what a display’s color profile says about the display, and nothing else in it', () => {
    const icc = profile([
      ['rXYZ', XYZ],
      ['mmod', MMOD],
      ['vcgt', CURVE],
      ['ndin', NDIN],
    ]);
    const picture = `\xff\xd8${JFIF}${iccSegment(icc)}${TABLE}${SCAN}${END}`;
    const file = pdf(page, image(picture), content);
    const before = textOf(file);
    const [found] = scanPdfImages(file).jpegs;
    expect(found!.blocks.map((block) => block.kind)).toEqual([DISPLAY, DISPLAY]);
    expect(found!.blocks.map((block) => block.marker)).toEqual([-1, -1]);
    expect(blankPdfImageMetadata(file)).toEqual([
      `image 1: ${DISPLAY}, ${MMOD.length - 8} bytes`,
      `image 1: ${DISPLAY}, ${NDIN.length - 8} bytes`,
    ]);
    const after = textOf(file);
    expect(after).not.toContain('MADE-UP SERIAL');
    expect(after).not.toContain('native panel');
    // The profile keeps its header, its tag table and every tag a color engine reads; the two
    // display tags keep their place and their type.
    expect(after).toContain(icc.slice(0, 128 + 4 + 4 * 12));
    expect(after).toContain(XYZ);
    expect(after).toContain(CURVE);
    expect(after).toContain(`mmod\0\0\0\0${'\0'.repeat(MMOD.length - 8)}`);
    expect(after).toContain(`ndin\0\0\0\0${'\0'.repeat(NDIN.length - 8)}`);
    expect([...after].filter((char, i) => char !== before[i])).toHaveLength(
      MMOD.length - 8 + NDIN.length - 8,
    );
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
    expect(blankPdfImageMetadata(file)).toEqual([]);
  });

  it('leaves a display’s profile alone, and says so, when it cannot tell where the details lie', () => {
    const line =
      'a JPEG image stream that has a color profile with display details this tool cannot place';
    // The display tag points at data that a tag for the colors also uses.
    const shared = profile([
      ['rXYZ', XYZ],
      ['mmod', XYZ, 'rXYZ'],
    ]);
    // The profile is spread over two segments, and the display tag's data is in the second.
    const long = profile([
      ['rXYZ', XYZ],
      ['mmod', MMOD],
    ]);
    const cut = long.length - 10;
    const twoSegments =
      iccSegment(long.slice(0, cut), '\x01\x02') + iccSegment(long.slice(cut), '\x02\x02');
    // A tag table that claims more tags than the profile has room for.
    const broken = Buffer.from(profile([['rXYZ', XYZ]]), 'latin1');
    broken.writeUInt32BE(1000, 128);
    for (const profileSegments of [
      iccSegment(shared),
      twoSegments,
      iccSegment(broken.toString('latin1')),
    ]) {
      const file = pdf(page, image(`\xff\xd8${JFIF}${profileSegments}${TABLE}${SCAN}${END}`));
      const before = textOf(file);
      expect(problems(file)).toEqual([line]);
      expect(scanPdfImages(file).jpegs[0]!.blocks).toEqual([]);
      expect(blankPdfImageMetadata(file)).toEqual([]);
      expect(textOf(file)).toBe(before);
    }
  });

  it('reports a display’s profile that the PDF keeps in a stream of its own', () => {
    const display = profile([
      ['rXYZ', XYZ],
      ['mmod', MMOD],
    ]);
    const line = 'a color profile with the details of one display';
    expect(problems(pdf(page, stream('/N 3', display)))).toEqual([line]);
    expect(problems(pdf(page, stream('/N 3 /Filter /FlateDecode', flate(display))))).toEqual([
      line,
    ]);
    // A profile without such tags, and one whose display tags are blank, are fine.
    expect(problems(pdf(page, stream('/N 3', profile([['rXYZ', XYZ]]))))).toEqual([]);
    const blank = profile([
      ['rXYZ', XYZ],
      ['mmod', `mmod\0\0\0\0${'\0'.repeat(32)}`],
    ]);
    expect(problems(pdf(page, stream('/N 3 /Filter /FlateDecode', flate(blank))))).toEqual([]);
  });

  it('keeps the colors of a photo with a display’s profile, in a decoder that reads the profile', async () => {
    // A photo in Display P3 as sharp writes it. Its profile then gets the two tags an Apple
    // display profile has, with made-up contents.
    const p3 = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 220, g: 40, b: 60 } },
    })
      .withIccProfile('p3')
      .jpeg({ quality: 90 })
      .toBuffer();
    const { icc } = await sharp(p3).metadata();
    expect(icc).toBeDefined();
    const count = icc!.readUInt32BE(128);
    const tableEnd = 132 + count * 12;
    const added: Array<[string, string]> = [
      ['mmod', MMOD],
      ['ndin', NDIN],
    ];
    const table = Buffer.from(icc!.subarray(128, tableEnd));
    table.writeUInt32BE(count + added.length, 0);
    for (let i = 0; i < count; i++)
      table.writeUInt32BE(table.readUInt32BE(8 + i * 12) + added.length * 12, 8 + i * 12);
    let offset = icc!.length + added.length * 12;
    const entries = added.map(([name, data]) => {
      const entry = Buffer.alloc(12);
      entry.write(name, 0, 'latin1');
      entry.writeUInt32BE(offset, 4);
      entry.writeUInt32BE(data.length, 8);
      offset += data.length;
      return entry;
    });
    const display = Buffer.concat([
      icc!.subarray(0, 128),
      table,
      ...entries,
      icc!.subarray(tableEnd),
      Buffer.from(added.map(([, data]) => data).join(''), 'latin1'),
    ]);
    display.writeUInt32BE(display.length, 0);

    // The photo's own segments, with the profile's segment replaced (or left out).
    const rebuilt = (replacement: string) => {
      let out = '\xff\xd8';
      let i = 2;
      while (p3[i + 1] !== 0xda) {
        const next = i + 2 + p3.readUInt16BE(i + 2);
        out += p3[i + 1] === 0xe2 ? replacement : p3.toString('latin1', i, next);
        i = next;
      }
      return out + p3.toString('latin1', i);
    };
    const photo = rebuilt(iccSegment(display.toString('latin1')));
    const pixels = (data: string | Uint8Array) =>
      sharp(typeof data === 'string' ? Buffer.from(data, 'latin1') : Buffer.from(data))
        .raw()
        .toBuffer();
    const original = await pixels(p3);
    // The decoder reads the profile: without it the same picture data gives other colors.
    expect((await pixels(rebuilt(''))).equals(original)).toBe(false);
    expect((await pixels(photo)).equals(original)).toBe(true);

    const file = pdf(page, image(photo), content);
    const [found] = scanPdfImages(file).jpegs;
    expect(found!.blocks.map((block) => block.kind)).toEqual([DISPLAY, DISPLAY]);
    blankPdfImageMetadata(file);
    expect(textOf(file)).not.toContain('MADE-UP SERIAL');
    expect(textOf(file)).not.toContain('native panel');
    expect((await pixels(file.subarray(found!.start, found!.end))).equals(original)).toBe(true);
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
    // The EXIF segment claims 0x4000 bytes. The stream ends long before that, but the file goes
    // on for longer: another object, and a second picture with EXIF of its own.
    const cut = `\xff\xd8${JFIF}\xff\xe1\x40\0Exif\0\0II*\0\x08\0\0\0 MADE-UP-GPS`;
    const next = `<< /Producer (the object after the picture: ${'x'.repeat(0x5000)}) >>`;
    const file = pdf(image(cut), next, content, image(jpeg(EXIF)));
    const before = textOf(file);
    const scan = scanPdfImages(file);
    expect(scan.unhandled).toHaveLength(1);
    expect(scan.unhandled[0]).toMatch(/has a segment that runs past the end of the stream/);
    // Only the second picture is found, and only its EXIF is blanked.
    expect(scan.jpegs).toHaveLength(1);
    expect(blankPdfImageMetadata(file)).toHaveLength(1);
    const after = textOf(file);
    const second = before.lastIndexOf('\xff\xd8');
    expect(after.slice(0, second)).toBe(before.slice(0, second));
    expect(after).toContain(next);
    // The backstop still reports the EXIF it could not remove.
    expect(pdfPhotoFindings(file).metadata).toEqual(['EXIF']);
  });

  it('takes a stream’s end from its /Length, and leaves the stream alone when that does not add up', () => {
    const data = jpeg(EXIF);
    const mismatch = 'a JPEG image stream whose length does not match where it ends';
    // A length that stops short of the picture's end.
    const short = pdf(page, `${imageDict(data.length - 7)}\nstream\n${data}\nendstream`, content);
    // A length kept in another object, and no "endstream" before the next object begins.
    const elsewhere = imageDict(0).replace('/Length 0', '/Length 9 0 R');
    const open = pdf(page, `${elsewhere}\nstream\n${data}`, content);
    for (const file of [short, open]) {
      const before = textOf(file);
      expect(problems(file)).toEqual([mismatch]);
      expect(scanPdfImages(file).jpegs).toEqual([]);
      expect(blankPdfImageMetadata(file)).toEqual([]);
      expect(textOf(file)).toBe(before);
    }
    // A length kept in another object: the stream ends at "endstream".
    const indirect = pdf(page, `${elsewhere}\nstream\n${data}\nendstream`, content);
    expect(problems(indirect)).toEqual([]);
    expect(scanPdfImages(indirect).jpegs[0]!.blocks.map((block) => block.kind)).toEqual(['EXIF']);
    // The words "endstream" and "endobj" inside a picture do not end it: its length does.
    const wordy = jpeg(iccSegment(profile([['desc', 'desc\0\0\0\0 endstream endobj ']])), EXIF);
    const file = pdf(page, image(wordy), content);
    expect(problems(file)).toEqual([]);
    const [found] = scanPdfImages(file).jpegs;
    expect(found!.end - found!.start).toBe(wordy.length);
    expect(found!.blocks.map((block) => block.kind)).toEqual(['EXIF']);
  });

  it('reports what it cannot vouch for', () => {
    const two = `${jpeg(EXIF)}${jpeg()}`;
    const trailer = `${jpeg()}SEFT made-up trailer`;
    const noEnd = `\xff\xd8${JFIF}${TABLE}${SCAN}`;
    const junk = `\xff\xd8${JFIF}JUNK${EXIF}${TABLE}${SCAN}${END}`;
    const zero = `\xff\xd8${JFIF}\xff\xe1\0\0${EXIF}${TABLE}${SCAN}${END}`;
    const cases: Array<[stream: string, problem: RegExp]> = [
      [image('x\x9c\x01\x02\x03', '[ /FlateDecode /DCTDecode ]'), /behind another filter/],
      [image('<~9jqo^~>', '[ /ASCII85Decode /DCTDecode ]'), /behind another filter/],
      [image('\0\0\0\x0cjP  \r\n\x87\n', '/JPXDecode'), /JPEG 2000/],
      [image('not a jpeg at all'), /does not start as a JPEG/],
      [image(two), /more data after the picture's end/],
      [image(trailer), /more data after the picture's end/],
      [image(noEnd), /has no end-of-image marker/],
      [image(junk), /is not a JPEG all the way through/],
      [image(zero), /has a segment with an impossible length/],
      [
        image(clean, '/DCTDecode', ' /Metadata 9 0 R'),
        /an image .* with a metadata stream of its own/,
      ],
      [
        stream(
          '/Type /Metadata /Subtype /XML',
          '<x:xmpmeta><exif:GPSLatitude>12,34.5N</exif:GPSLatitude></x:xmpmeta>',
        ),
        /a metadata stream .* with camera, location or contact fields/,
      ],
      // Fields written as attributes, in a packet that is compressed.
      [
        stream(
          '/Type /Metadata /Subtype /XML /Filter /FlateDecode',
          flate(
            '<x:xmpmeta><rdf:Description xmlns:tiff="http://ns.adobe.com/tiff/1.0/" tiff:Model="Sample Camera"/></x:xmpmeta>',
          ),
        ),
        /a metadata stream .* with camera, location or contact fields/,
      ],
      [
        stream('/Filter /FlateDecode', 'hello'),
        /a stream .* that this scan cannot read \(\/FlateDecode\)/,
      ],
      [
        stream('/Filter /LZWDecode', 'hello'),
        /a stream .* that this scan cannot read \(\/LZWDecode\)/,
      ],
      [stream('/Filter /ASCIIHexDecode', '48 65 6c 6c 6f zz>'), /cannot read \(\/ASCIIHexDecode\)/],
      [stream('/Filter /ASCII85Decode', '<~87cURD]\x7f~>'), /cannot read \(\/ASCII85Decode\)/],
      [stream('/Filter 9 0 R', 'hello'), /a stream .* whose filter is named in another object/],
      [
        stream('/Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 4 >>', flate('hello')),
        /a stream .* that this scan cannot read \(stored with a predictor\)/,
      ],
    ];
    for (const [body, problem] of cases) {
      const file = pdf(page, body, content);
      const scan = scanPdfImages(file);
      expect(scan.unhandled, String(problem)).toHaveLength(1);
      expect(scan.unhandled[0]).toMatch(problem);
      // Nothing is blanked in a stream the scan could not walk. (A picture it did walk is
      // blanked, also when more data follows it: that is reported, and its bytes stay.)
      const before = textOf(file);
      const walked = scan.jpegs.flatMap((found) => found.blocks).length;
      expect(blankPdfImageMetadata(file), String(problem)).toHaveLength(walked);
      if (walked === 0) expect(textOf(file), String(problem)).toBe(before);
      else expect(textOf(file).slice(scan.jpegs[0]!.end)).toBe(before.slice(scan.jpegs[0]!.end));
    }
  });

  it('reads what it can of the other streams, and reports nothing for the ones that are fine', () => {
    const fine = [
      stream('/Filter /FlateDecode', flate('BT (Hello) Tj ET')),
      stream('/Filter [ /ASCII85Decode /FlateDecode ]', ascii85(flate('BT (Hello) Tj ET'))),
      stream('/Filter /ASCIIHexDecode', '48 65 6c 6c 6f>'),
      // A cross-reference stream holds offsets; its predictor hides nothing.
      stream(
        '/Type /XRef /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 4 >>',
        flate('\x02\x01\0\0\x10'),
      ),
      // Bytes that start like a JPEG and are not one.
      stream(
        '',
        '\xff\xd8\xff\0 not a picture \xff\xd8\xff\xe0\xff\xff \xff\xd8\xff\xe0\0\x04ab-- \xff\xd8\xff\xe0\0\x04ab\xff\xdb\0\x04cd-- \xff\xd8\xff\0\0\x04ab\xff\0\0\x04cd\xff',
      ),
      stream(
        '/Type /Metadata /Subtype /XML',
        '<x:xmpmeta xmlns:dc="http://purl.org/dc/elements/1.1/"/>',
      ),
    ];
    expect(problems(pdf(page, ...fine))).toEqual([]);
  });

  it('reports an encrypted file', () => {
    const file = textOf(pdf(page, image(clean), content)).replace(
      '<< /Size',
      '<< /Encrypt 9 0 R /Size',
    );
    expect(problems(bytesOf(file))).toEqual(['an encrypted file, which this scan cannot read']);
  });

  it('reports a file attachment, however the PDF names it', () => {
    const line = ['a file attachment'];
    const names = '<< /Type /Catalog /Names << /EmbeddedFiles 7 0 R >> >>';
    const filespec = '<< /Type /Filespec /F (data.csv) /UF (data.csv) >>';
    const reference = '<< /F (data.csv) /EF << /F 8 0 R >> >>';
    const file = stream('/Type /EmbeddedFile', 'a,b\n1,2\n');
    // In a PDF that compresses its objects, only the object stream names the attachment.
    const packed = stream(
      '/Type /ObjStm /N 1 /First 4 /Filter /FlateDecode',
      flate(`7 0 ${filespec}`),
    );
    for (const body of [names, filespec, reference, file, packed])
      expect(problems(pdf(page, body, content)), body.slice(0, 40)).toEqual(line);
    expect(problems(pdf(page, names, filespec, reference, file, packed))).toEqual(line);
    expect(problems(pdf(page, content))).toEqual([]);
  });

  it('finds a JPEG that no image dictionary announces, and metadata inside an encoded stream', () => {
    // A whole JPEG in a stream whose dictionary does not say what it is.
    const hidden = scanPdfImages(pdf(page, stream('', withMetadata)));
    expect(hidden.jpegs).toEqual([]);
    expect(hidden.unhandled).toHaveLength(1);
    expect(hidden.unhandled[0]).toMatch(/JPEG data at byte \d+ outside the image streams/);

    // An inline image in a page's content, under each way of writing its filter and the stream's.
    const inline = `q BI /W 4 /H 4 /F /DCT ID ${EXIF} EI Q`;
    const long = `q BI /Width 4 /Height 4 /Filter /DCTDecode ID ${EXIF} EI Q`;
    const found = ['EXIF inside a compressed stream', 'an inline JPEG image inside a stream'];
    const encoded = [
      stream('/Filter /FlateDecode', flate(inline)),
      stream('/Filter [ /FlateDecode ]', flate(long)),
      stream('/Filter [ /ASCII85Decode /FlateDecode ]', ascii85(flate(inline))),
      stream('/Filter /ASCIIHexDecode', `${Buffer.from(long, 'latin1').toString('hex')}>`),
      // "z" stands for four zero bytes.
      stream('/Filter /ASCII85Decode', `z${ascii85(inline)}`),
    ];
    for (const body of encoded) {
      const file = pdf(page, body);
      expect(problems(file), body.slice(0, 50)).toEqual(found);
      // The raw bytes show nothing, so only the scan finds it.
      expect(pdfMetadataSignatures(file)).toEqual([]);
    }
    // Not compressed: the raw bytes show the EXIF, the scan the inline image.
    const plain = pdf(page, stream('', long));
    expect(problems(plain)).toEqual(['an inline JPEG image inside a stream']);
    expect(pdfMetadataSignatures(plain)).toEqual(['EXIF']);
  });

  it('leaves other streams alone, even when their bytes say "stream"', () => {
    const tricky = jpeg(iccSegment(profile([['desc', 'desc\0\0\0\0 x >>\nstream\n']])), EXIF);
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
    const packet = stream(
      '/Type /Metadata /Subtype /XML',
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:Description xmlns:xap="http://ns.adobe.com/xap/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"/></x:xmpmeta>',
    );
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

describe('everything a PDF holds besides its photos’ segments (D78)', () => {
  const clean = jpeg(ICC, ADOBE);
  /** The same file with a trailer that names object `id` as the document information. */
  const withInfo = (id: number, file: Uint8Array) =>
    bytesOf(textOf(file).replace('<< /Size', `<< /Info ${id} 0 R /Size`));
  /** A compressed object stream that holds these objects, as a PDF 1.5 writer packs them. */
  function objectStream(objects: Array<[id: number, body: string]>): string {
    const heads: string[] = [];
    let bodies = '';
    for (const [id, body] of objects) {
      heads.push(`${id} ${bodies.length}`);
      bodies += `${body}\n`;
    }
    const header = `${heads.join(' ')}\n`;
    return stream(
      `/Type /ObjStm /N ${objects.length} /First ${header.length} /Filter /FlateDecode`,
      flate(header + bodies),
    );
  }
  const AUTHORS = (n: number) =>
    `author records outside the document information: ${n} in all, such as a figure’s own`;

  it('reports every photo and every problem, not only the first', () => {
    const credentials = segment(0xeb, 'JP\0\x01 made-up credentials: Sample Person');
    const file = pdf(
      page,
      image(jpeg(EXIF)),
      image(clean),
      image(jpeg(COMMENT, credentials)),
      content,
    );
    expect(pdfPhotoFindings(file).metadata).toEqual(['EXIF', 'comment', 'APP11']);
    expect(blankPdfImageMetadata(file).map((line) => line.replace(/, \d+ bytes$/, ''))).toEqual([
      'image 1: EXIF',
      'image 3: comment',
      'image 3: APP11',
    ]);
    for (const gone of ['MADE-UP-GPS', 'sample tool', 'Sample Person'])
      expect(textOf(file), gone).not.toContain(gone);
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
    // Two things it cannot vouch for: both are listed.
    const two = pdf(
      page,
      image('\0\0\0\x0cjP  \r\n\x87\n', '/JPXDecode'),
      stream('/Type /EmbeddedFile', 'a,b\n1,2\n'),
      content,
    );
    expect(problems(two)).toEqual(['a JPEG 2000 image stream', 'a file attachment']);
    // What check:privacy reads lists both too.
    expect(pdfPhotoFindings(two).unhandled.map((line) => line.replace(/ at byte \d+/, ''))).toEqual(
      ['a JPEG 2000 image stream', 'a file attachment'],
    );
  });

  it('finds each JPEG outside the image streams, wherever it sits and however long its segments', () => {
    // One starts with a 400-byte application segment, the other with tables and a comment.
    const first = `\xff\xd8${segment(0xe1, 'x'.repeat(396))}${TABLE}${SCAN}${END}`;
    const second = `\xff\xd8${TABLE}${COMMENT}${SCAN}${END}`;
    const file = pdf(page, image(clean), stream('', first), image(clean), stream('', second));
    const text = textOf(file);
    expect(scanPdfImages(file).unhandled).toEqual(
      [first, second].map(
        (hidden) =>
          `JPEG data at byte ${text.indexOf(hidden)} outside the image streams this scan found`,
      ),
    );
    expect(scanPdfImages(file).jpegs).toHaveLength(2);
  });

  it('counts an APP15 segment with something in it as metadata, and big-endian EXIF too', () => {
    const app15 = segment(0xef, 'made-up text: Sample Person');
    const file = pdf(page, image(jpeg(app15)), content);
    expect(scanPdfImages(file).jpegs[0]!.blocks.map((block) => block.kind)).toEqual(['APP15']);
    blankPdfImageMetadata(file);
    expect(textOf(file)).not.toContain('Sample Person');
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
    // EXIF in Motorola byte order, where only the backstops can see it.
    const big = 'Exif\0\0MM\0*\0\0\0\x08 MADE-UP-GPS';
    const cut = `\xff\xd8${JFIF}\xff\xe1\x40\0${big}`;
    expect(pdfPhotoFindings(pdf(page, image(cut))).metadata).toEqual(['EXIF']);
    expect(problems(pdf(page, stream('/Filter /FlateDecode', flate(big))))).toEqual([
      'EXIF inside a compressed stream',
    ]);
  });

  it('knows every namespace of camera, location and contact fields', () => {
    const namespaces = [
      'exif',
      'exifEX',
      'tiff',
      'aux',
      'crs',
      'photoshop',
      'Iptc4xmpCore',
      'Iptc4xmpExt',
    ];
    for (const ns of namespaces) {
      const packet = `<x:xmpmeta><rdf:Description xmlns:${ns}="http://example.invalid/${ns}/"/></x:xmpmeta>`;
      expect(problems(pdf(page, stream('/Type /Metadata /Subtype /XML', packet))), ns).toEqual([
        'a metadata stream with camera, location or contact fields',
      ]);
    }
  });

  it('reads what real papers have: every restart marker, long dictionaries, dictionaries without spaces', () => {
    // A restart interval, and scan data that cycles through RST0 to RST7.
    const restarts = Array.from(
      { length: 8 },
      (_, k) => `\x12\x34\xff${String.fromCharCode(0xd0 + k)}`,
    );
    const scan = `\xff\xda\0\x08\x01\x01\0\0\x3f\0${restarts.join('')}\x56\x78`;
    const photo = `\xff\xd8${JFIF}${EXIF}${TABLE}${segment(0xdd, '\0\x04')}${scan}${END}`;
    const file = pdf(page, image(photo), content);
    expect(scanPdfImages(file).unhandled).toEqual([]);
    expect(blankPdfImageMetadata(file).map((line) => line.replace(/, \d+ bytes$/, ''))).toEqual([
      'image 1: EXIF',
    ]);
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });

    // Dictionaries of 700 bytes, with what matters at their two ends.
    const note = `/Note (${'x'.repeat(600)})`;
    const long = jpeg(EXIF);
    const longImage = `<< /Subtype /Image /Filter /DCTDecode /Width 4 /Height 4 ${note} /Length ${long.length} /Metadata 9 0 R >>\nstream\n${long}\nendstream`;
    const xrefData = flate('\x02\x01\0\0\x10');
    const longXref = `<< /Type /XRef ${note} /Filter /FlateDecode /Length ${xrefData.length} /DecodeParms << /Predictor 12 /Columns 4 >> >>\nstream\n${xrefData}\nendstream`;
    const longFile = pdf(page, longImage, longXref);
    expect(scanPdfImages(longFile).jpegs[0]!.blocks.map((block) => block.kind)).toEqual(['EXIF']);
    expect(problems(longFile)).toEqual(['an image with a metadata stream of its own']);

    // The same cases written without spaces.
    const packet = '<x:xmpmeta><exif:GPSLatitude>12,34.5N</exif:GPSLatitude></x:xmpmeta>';
    const packed = flate('7 0 <</Type/Filespec/F(data.csv)>>');
    const compact = [
      `<</Type/XObject/Subtype/Image/Width 4/Height 4/Filter/DCTDecode/Length ${clean.length}/Metadata 9 0 R>>stream\n${clean}\nendstream`,
      `<</Type/Metadata/Subtype/XML/Length ${packet.length}>>stream\n${packet}\nendstream`,
      `<</Type/ObjStm/N 1/First 4/Filter/FlateDecode/Length ${packed.length}>>stream\n${packed}\nendstream`,
      `<</Type/XRef/Filter/FlateDecode/DecodeParms<</Predictor 12/Columns 4>>/Length ${xrefData.length}>>stream\n${xrefData}\nendstream`,
    ];
    expect(problems(pdf(page, ...compact))).toEqual([
      'an image with a metadata stream of its own',
      'a metadata stream with camera, location or contact fields',
      'a file attachment',
    ]);
  });

  it('reports author records outside the document information, as a drawing program leaves one per figure', () => {
    const info = '<< /Author (Made-Up Writer) /Title (A paper) >>';
    const record =
      '<< /Author (Made-Up Person) /Creator (A drawing program) /Title (figure1.eps) >>';
    // The document's own information is fine, and so is a file without any.
    expect(problems(withInfo(1, pdf(info, page, content)))).toEqual([]);
    expect(problems(pdf(page, content))).toEqual([]);
    // Two figures' records, as plain objects.
    expect(problems(withInfo(1, pdf(info, page, content, record, record)))).toEqual([AUTHORS(2)]);
    // Without a trailer that names it, even the document's information counts.
    expect(problems(pdf(info, page, content))).toEqual([AUTHORS(1)]);
    // In a compressed object stream, which may hold the document information too.
    const packed = objectStream([
      [7, info],
      [8, record],
    ]);
    expect(problems(withInfo(7, pdf(page, content, packed)))).toEqual([AUTHORS(1)]);
    expect(problems(withInfo(7, pdf(page, content, objectStream([[7, info]]))))).toEqual([]);
    // In a page's content, as a marked-content property list.
    const marked = stream(
      '/Filter /FlateDecode',
      flate('/EmbeddedDocument << /Author (Made-Up Person) >> BDC q Q EMC'),
    );
    expect(problems(withInfo(1, pdf(info, page, marked)))).toEqual([AUTHORS(1)]);
  });

  it('reports what pdfTeX keeps of an included figure, an application’s private data, and a figure’s own XMP', () => {
    const form = (extra: string) =>
      stream(`/Type /XObject /Subtype /Form /BBox [0 0 10 10] ${extra}`, 'q Q');
    for (const key of [
      '/PTEX.FileName (/home/sample/figures/plot.pdf)',
      '/PTEX_FileName (plot.pdf)',
      '/PTEX.InfoDict 9 0 R',
    ])
      expect(problems(pdf(page, form(key))), key).toEqual([
        'an included figure’s file name or information (pdfTeX)',
      ]);
    const piece = '<< /Type /Page /PieceInfo << /Illustrator << /Private 9 0 R >> >> >>';
    expect(problems(pdf(piece, content))).toEqual(['an application’s private data (/PieceInfo)']);
    expect(problems(pdf(page, objectStream([[7, piece]])))).toEqual([
      'an application’s private data (/PieceInfo)',
    ]);
    expect(problems(pdf(page, objectStream([[7, '<< /PTEX.FileName (plot.pdf) >>']])))).toEqual([
      'an included figure’s file name or information (pdfTeX)',
    ]);
    expect(problems(pdf(page, form('/Metadata 9 0 R')))).toEqual([
      'a figure with a metadata stream of its own',
    ]);
  });

  it('finds photo metadata without its JPEG wrapper, as private data keeps it', () => {
    const tiff = 'II*\0\x08\0\0\0 made-up directory with GPS';
    const motorola = 'MM\0*\0\0\0\x08 made-up directory';
    const iptc = '8BIM\x04\x04\0\0\0\0\0\x10made-up caption';
    const packet = '<x:xmpmeta><exif:GPSLatitude>12,34.5N</exif:GPSLatitude></x:xmpmeta>';
    const cases: Array<[string, string]> = [
      [tiff, 'TIFF/EXIF inside a compressed stream'],
      [motorola, 'TIFF/EXIF inside a compressed stream'],
      [iptc, 'IPTC/Photoshop inside a compressed stream'],
      [packet, 'camera, location or contact fields in a stream'],
      [jpeg(COMMENT), 'JPEG data inside a compressed stream'],
    ];
    for (const [data, line] of cases)
      expect(problems(pdf(page, stream('/Filter /FlateDecode', flate(data)))), line).toEqual([
        line,
      ]);
    // Not compressed: the backstop over the file's bytes sees it.
    expect(pdfPhotoFindings(pdf(page, stream('', tiff))).metadata).toEqual(['TIFF/EXIF']);
    expect(pdfPhotoFindings(pdf(page, stream('', iptc))).metadata).toEqual(['IPTC/Photoshop']);
    // A multi-picture index has the same header after its own name, and is reported as itself.
    const mpf = segment(0xe2, 'MPF\0MM\0*\0\0\0\x08 made-up index');
    const file = pdf(page, image(jpeg(mpf)));
    expect(pdfPhotoFindings(file).metadata).toEqual(['MPF']);
    blankPdfImageMetadata(file);
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
  });

  it('reports a comment or other markup, and a signature, plain or packed, but not links and form fields', () => {
    const comment =
      '<< /Type /Annot /Subtype /Text /F 2 /T (Made-Up Reviewer) /Contents (a made-up note) >>';
    const signature = '<< /Type /Sig /Name (Made-Up Signer) /Location (A made-up place) >>';
    const link =
      '<< /Type /Annot /Subtype /Link /A << /S /URI /URI (https://example.invalid) >> >>';
    const widget = '<< /Type /Annot /Subtype /Widget /FT /Sig /T (Signature1) >>';
    const MARKUP_LINE = 'a comment or other markup, with its author and its text';
    const SIGNATURE_LINE = 'a digital signature, which may name the signer and a place';
    expect(problems(pdf(page, content, link, widget))).toEqual([]);
    expect(problems(pdf(page, content, comment))).toEqual([MARKUP_LINE]);
    expect(problems(pdf(page, content, signature))).toEqual([SIGNATURE_LINE]);
    expect(
      problems(
        pdf(
          page,
          objectStream([
            [7, comment],
            [8, signature],
          ]),
        ),
      ),
    ).toEqual([MARKUP_LINE, SIGNATURE_LINE]);
  });

  it('says where each record of the whole file is: the first in the file’s text, or the object stream that holds it', () => {
    const record = '<< /Author (Made-Up Person) /Creator (A drawing program) >>';
    const piece = '<< /Type /Page /PieceInfo << /Illustrator << /Private 9 0 R >> >> >>';
    const file = pdf(page, content, record, piece, record);
    const text = textOf(file);
    expect(scanPdfImages(file).unhandled).toEqual([
      `an application’s private data (/PieceInfo) at byte ${text.indexOf('/PieceInfo')}`,
      `author records outside the document information at byte ${text.indexOf('/Author')}: 2 in all, such as a figure’s own`,
    ]);
    const packed = pdf(
      page,
      content,
      objectStream([
        [7, piece],
        [8, record],
      ]),
    );
    const at = textOf(packed).indexOf('stream\n', textOf(packed).indexOf('/ObjStm')) + 7;
    expect(scanPdfImages(packed).unhandled).toEqual([
      `an application’s private data (/PieceInfo) at byte ${at}`,
      `author records outside the document information at byte ${at}: 1 in all, such as a figure’s own`,
    ]);
    // An author key in a page's content is placed at that stream.
    const marked = stream(
      '/Filter /FlateDecode',
      flate('/X << /Author (Made-Up Person) >> BDC EMC'),
    );
    const inContent = pdf(page, marked);
    const start =
      textOf(inContent).indexOf('stream\n', textOf(inContent).indexOf('/FlateDecode')) + 7;
    expect(scanPdfImages(inContent).unhandled).toEqual([
      `author records outside the document information at byte ${start}: 1 in all, such as a figure’s own`,
    ]);
  });

  it('reports an earlier revision kept in the file, but not a linearized file’s second section or an outline’s links', () => {
    const update = (file: Uint8Array, prev: number) =>
      bytesOf(
        `${textOf(file)}xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 3 /Prev ${prev} >>\nstartxref\n0\n%%EOF\n`,
      );
    const once = pdf(page, content);
    const twice = update(once, 9);
    expect(problems(twice)).toEqual([
      'an earlier revision kept in the file, with objects no page may show',
    ]);
    // Two updates: the place is the newest link.
    const thrice = update(twice, 99);
    expect(scanPdfImages(thrice).unhandled).toEqual([
      `an earlier revision kept in the file at byte ${textOf(thrice).lastIndexOf('/Prev')}, with objects no page may show`,
    ]);
    // A linearized file: its first section links the main one once.
    const linear = pdf(
      '<< /Linearized 1 /L 1000 /O 2 /E 900 /N 1 /T 800 /H [ 0 0 ] >>',
      page,
      content,
    );
    expect(problems(update(linear, 9))).toEqual([]);
    expect(problems(update(update(linear, 9), 99))).toEqual([
      'an earlier revision kept in the file, with objects no page may show',
    ]);
    // An outline item links the one before it: an object, not a revision.
    expect(
      problems(pdf(page, content, '<< /Title (Introduction) /Prev 7 0 R /Next 9 0 R >>')),
    ).toEqual([]);
  });

  it('reports a stream whose length does not add up, and fields hidden in pixels or after compressed data', () => {
    // A stream that says it is shorter than it is: what follows is read by no decoder.
    const data = 'BT (Hello) Tj ET';
    const short = `<< /Length ${data.length - 5} >>\nstream\n${data}\nendstream`;
    expect(problems(pdf(page, short))).toEqual([
      'a stream whose length does not match where it ends',
    ]);
    const packet = '<x:xmpmeta><exif:GPSLatitude>12,34.5N</exif:GPSLatitude></x:xmpmeta>';
    // An image whose stored bytes are a packet.
    expect(problems(pdf(page, image(packet, '/FlateDecode')))).toEqual([
      'camera, location or contact fields in an image stream',
    ]);
    // A packet after the end of a compressed stream's data, inside its stated length.
    const tail = stream('/Filter /FlateDecode', `${flate('q Q')}${packet}`);
    expect(problems(pdf(page, tail))).toEqual(['camera, location or contact fields in a stream']);
  });

  it('blanks a profile’s metadata dictionary, and leaves alone a profile it cannot read whole', () => {
    const META = 'meta\0\0\0\0made-up EDID serial 0123456789';
    const icc = profile([
      ['rXYZ', XYZ],
      ['meta', META],
    ]);
    const file = pdf(
      page,
      image(`\xff\xd8${JFIF}${iccSegment(icc)}${TABLE}${SCAN}${END}`),
      content,
    );
    expect(scanPdfImages(file).jpegs[0]!.blocks.map((block) => block.kind)).toEqual([DISPLAY]);
    blankPdfImageMetadata(file);
    expect(textOf(file)).not.toContain('EDID serial');
    expect(textOf(file)).toContain(XYZ);
    expect(pdfPhotoFindings(file)).toEqual({ metadata: [], unhandled: [] });
    // In a profile stream of its own.
    expect(problems(pdf(page, stream('/N 3 /Filter /FlateDecode', flate(icc))))).toEqual([
      'a color profile with the details of one display',
    ]);
    const cannot =
      'a JPEG image stream that has a color profile with display details this tool cannot place';
    // A first segment too short for the tag table: the details may be in the second one.
    const display = profile([
      ['rXYZ', XYZ],
      ['mmod', MMOD],
    ]);
    const split =
      iccSegment(display.slice(0, 100), '\x01\x02') + iccSegment(display.slice(100), '\x02\x02');
    // A display tag whose data would be the tag table, or the header.
    const pointing = (offset: number) => {
      const crafted = Buffer.from(display, 'latin1');
      crafted.writeUInt32BE(offset, 136 + 12);
      return iccSegment(crafted.toString('latin1'));
    };
    for (const segments of [split, pointing(132), pointing(0)]) {
      const crafted = pdf(page, image(`\xff\xd8${JFIF}${segments}${TABLE}${SCAN}${END}`));
      const before = textOf(crafted);
      expect(problems(crafted)).toEqual([cannot]);
      expect(blankPdfImageMetadata(crafted)).toEqual([]);
      expect(textOf(crafted)).toBe(before);
    }
  });

  it('reads a filter’s short name and an escaped name, and reports a filter or a segment it does not know', () => {
    const photo = jpeg(EXIF);
    // A plain JPEG, however its filter is spelled.
    for (const filter of ['/DCT', '/DCTDecod#65', '[ /DCT ]']) {
      const file = pdf(page, image(photo, filter));
      expect(
        scanPdfImages(file).jpegs[0]!.blocks.map((block) => block.kind),
        filter,
      ).toEqual(['EXIF']);
    }
    // Behind another filter, however spelled.
    for (const filter of ['[ /Fl /DCT ]', '[ /A85 /DCT ]', '[ /FlateDecode /DCTDecod#65 ]'])
      expect(problems(pdf(page, image(photo, filter))), filter).toEqual([
        'a JPEG image stream behind another filter',
      ]);
    // Pixels behind filters that hold only pixels are fine; another filter is reported.
    expect(problems(pdf(page, image('made-up pixels', '[ /A85 /Fl ]')))).toEqual([]);
    expect(problems(pdf(page, image('made-up pixels', '/Crypt')))).toEqual([
      'an image stream with a filter this scan does not know (/Crypt)',
    ]);
    // Segments a decoder skips: a number-of-lines segment with more in it, and a kind that no
    // decoder reads. A number-of-lines segment of its own size is fine.
    expect(problems(pdf(page, image(jpeg(segment(0xdc, '\0\x10')))))).toEqual([]);
    expect(problems(pdf(page, image(jpeg(segment(0xdc, 'made-up name')))))).toEqual([
      'a JPEG image stream that has a number-of-lines segment with more in it',
    ]);
    expect(problems(pdf(page, image(jpeg(segment(0xf0, 'made-up name')))))).toEqual([
      'a JPEG image stream that has a segment of a kind this tool does not know (0xf0)',
    ]);
  });
});

describe('npm run strip-pdf (D78)', () => {
  const run = (...files: string[]) => {
    try {
      const out = execFileSync(process.execPath, ['scripts/strip-pdf-metadata.ts', ...files], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { status: 0, text: out };
    } catch (error) {
      const failed = error as { status: number; stdout: string; stderr: string };
      return { status: failed.status, text: failed.stdout + failed.stderr };
    }
  };

  it('exits with an error for each way a file can fail, alone, and says how to use it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'strip-pdf-'));
    try {
      expect(run().status).toBe(2);
      expect(run().text).toContain('Usage: npm run strip-pdf -- <file.pdf> [...]');
      const missing = join(dir, 'missing.pdf');
      expect(run(missing)).toEqual({
        status: 1,
        text: `${missing}: could not be processed (ENOENT)\n`,
      });
      const notes = join(dir, 'notes.pdf');
      writeFileSync(notes, 'Not a PDF, just text.');
      expect(run(notes)).toEqual({ status: 1, text: `${notes}: not a PDF\n` });
      expect(readFileSync(notes, 'utf8')).toBe('Not a PDF, just text.');
      // EXIF where no JPEG is: the tool cannot blank it, and says so.
      const loose = join(dir, 'loose.pdf');
      writeFileSync(loose, pdf(page, stream('', 'Exif\0\0II*\0\x08\0\0\0 MADE-UP-GPS')));
      const still = run(loose);
      expect(still.status).toBe(1);
      expect(still.text).toBe(`${loose}: 0 JPEG image(s); nothing to blank\n  STILL THERE: EXIF\n`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('saves a file with one block blanked, and the output says what it did', () => {
    const dir = mkdtempSync(join(tmpdir(), 'strip-pdf-'));
    try {
      const paper = join(dir, 'paper.pdf');
      const original = pdf(page, image(jpeg(EXIF)), content);
      writeFileSync(paper, original);
      expect(run(paper)).toEqual({
        status: 0,
        text: `${paper}: 1 JPEG image(s); blanked 1 range(s)\n  image 1: EXIF, ${EXIF.length - 4} bytes\n`,
      });
      const stripped = new Uint8Array(readFileSync(paper));
      expect(stripped.length).toBe(original.length);
      expect(textOf(stripped)).not.toContain('MADE-UP-GPS');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blanks a file in place, goes on after a file it cannot read, and exits with an error for it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'strip-pdf-'));
    try {
      const paper = join(dir, 'paper.pdf');
      const notes = join(dir, 'notes.pdf');
      const missing = join(dir, 'missing.pdf');
      const original = pdf(page, image(jpeg(EXIF, COMMENT)), content);
      writeFileSync(paper, original);
      writeFileSync(notes, 'Not a PDF, just text.');
      const first = run(missing, notes, paper);
      expect(first.status).toBe(1);
      expect(first.text).toContain(`${missing}: could not be processed (ENOENT)`);
      expect(first.text).toContain(`${notes}: not a PDF`);
      expect(first.text).toContain(`${paper}: 1 JPEG image(s); blanked 2 range(s)`);
      const stripped = new Uint8Array(readFileSync(paper));
      expect(stripped.length).toBe(original.length);
      expect(textOf(stripped)).not.toContain('MADE-UP-GPS');
      expect(pdfPhotoFindings(stripped)).toEqual({ metadata: [], unhandled: [] });
      // The file it could not read is as it was.
      expect(readFileSync(notes, 'utf8')).toBe('Not a PDF, just text.');
      // A second run finds nothing to do and succeeds.
      const second = run(paper);
      expect(second).toEqual({ status: 0, text: `${paper}: 1 JPEG image(s); nothing to blank\n` });
      expect(Buffer.from(readFileSync(paper)).equals(Buffer.from(stripped))).toBe(true);
      // What the tool cannot vouch for is an error, too.
      const odd = join(dir, 'odd.pdf');
      writeFileSync(odd, pdf(page, image(`${jpeg()}made-up trailer`), content));
      const third = run(odd);
      expect(third.status).toBe(1);
      expect(third.text).toMatch(/NOT HANDLED: a JPEG image stream at byte \d+ with more data/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
