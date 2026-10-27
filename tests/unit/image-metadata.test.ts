// Constructed images with metadata in the places a header-only reader misses.
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  convertFirstKind,
  findDataUriImages,
  isFontFile,
  readImageMetadata,
  unscannableKind,
} from '../../scripts/lib/image-metadata.ts';
import { exifHasGps } from '../../scripts/lib/privacy-rules.ts';

const blank = () => sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } });
const gpsExif = {
  IFD0: { Make: 'Fixture' },
  IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '29/1 38/1 0/1' },
};

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

function beforeIend(png: Buffer, chunk: Buffer): Buffer {
  const at = png.indexOf(Buffer.from('IEND')) - 4;
  return Buffer.concat([png.subarray(0, at), chunk, png.subarray(at)]);
}

describe('readImageMetadata', () => {
  it('finds EXIF with GPS in a JPEG', async () => {
    const meta = readImageMetadata(await blank().jpeg().withExif(gpsExif).toBuffer());
    expect(meta.blocks).toContain('EXIF');
    expect(meta.exif.some((exif) => exifHasGps(exif))).toBe(true);
  });

  it('finds a PNG eXIf chunk placed after the image data', async () => {
    const jpegExif = (await sharp(await blank().jpeg().withExif(gpsExif).toBuffer()).metadata())
      .exif!;
    const png = beforeIend(
      await blank().png().toBuffer(),
      pngChunk('eXIf', Buffer.from(jpegExif.subarray(6))),
    );
    expect((await sharp(png).metadata()).exif).toBeUndefined(); // what sharp alone would miss
    const meta = readImageMetadata(png);
    expect(meta.blocks).toContain('EXIF');
    expect(meta.exif.some((exif) => exifHasGps(exif))).toBe(true);
  });

  it('returns PNG text chunks and JPEG comments as text, and spots raw profiles', async () => {
    // Assembled at run time so check:privacy doesn't flag a phone-shaped literal in this file.
    const phone = ['212', '555', '2368'].join(' ');
    const png = beforeIend(
      await blank().png().toBuffer(),
      pngChunk('tEXt', Buffer.from(`Comment\0Call ${phone}`, 'latin1')),
    );
    expect(readImageMetadata(png).texts.join()).toContain(phone);
    const raw = beforeIend(
      await blank().png().toBuffer(),
      pngChunk('tEXt', Buffer.from('Raw profile type exif\0\nexif\n 4\n45786966\n', 'latin1')),
    );
    expect(readImageMetadata(raw).blocks).toContain('raw exif profile');
    const jpeg = await blank().jpeg().toBuffer();
    const comment = Buffer.from(`Cell: ${phone}`, 'latin1');
    const segment = Buffer.concat([Buffer.from([0xff, 0xfe, 0, comment.length + 2]), comment]);
    const withComment = Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
    expect(readImageMetadata(withComment).texts).toEqual([`Cell: ${phone}`]);
  });

  it('finds GIF comments and XMP, and WebP EXIF', async () => {
    const gif = await blank().gif().toBuffer();
    const text = Buffer.from('note', 'latin1');
    const extensions = Buffer.concat([
      Buffer.from([0x21, 0xfe, text.length]),
      text,
      Buffer.from([0, 0x21, 0xff, 11]),
      Buffer.from('XMP DataXMP', 'latin1'),
      Buffer.from([3]),
      Buffer.from('<x>', 'latin1'),
      Buffer.from([0]),
    ]);
    const meta = readImageMetadata(
      Buffer.concat([gif.subarray(0, -1), extensions, gif.subarray(-1)]),
    );
    expect(meta.texts).toEqual(['note']);
    expect(meta.blocks).toContain('XMP');
    const webp = await blank()
      .webp()
      .withExif({ IFD0: { Make: 'Fixture' } })
      .toBuffer();
    expect(readImageMetadata(webp).blocks).toContain('EXIF');
  });

  it('passes images without metadata', async () => {
    for (const image of [
      await blank().jpeg().toBuffer(),
      await blank().png().toBuffer(),
      await blank().webp().toBuffer(),
    ]) {
      expect(readImageMetadata(image)).toMatchObject({ blocks: [], texts: [] });
    }
  });
});

describe('file types', () => {
  it('recognizes fonts by signature, not extension', async () => {
    expect(isFontFile(Buffer.from('wOF2\0\0\0\0'))).toBe(true);
    expect(isFontFile(await blank().jpeg().toBuffer())).toBe(false);
  });

  it('recognizes containers it cannot look inside', () => {
    expect(unscannableKind(Buffer.from('%PDF-1.7\n<x:xmpmeta>'))).toBe('PDF');
    expect(unscannableKind(Buffer.from('PK\x03\x04', 'latin1'))).toMatch(/ZIP/);
    expect(unscannableKind(Buffer.from('\0\0\0\x18ftypmp42', 'latin1'))).toMatch(/MP4/);
    expect(unscannableKind(Buffer.from('plain text'))).toBeNull();
  });

  it('finds base64 images in text', async () => {
    const b64 = (await blank().jpeg().withExif(gpsExif).toBuffer()).toString('base64');
    const [found] = findDataUriImages(`.x{background:url(data:image/jpeg;base64,${b64})}`);
    expect(found?.type).toBe('jpeg');
    expect(readImageMetadata(found!.bytes).blocks).toContain('EXIF');
  });
});

describe('convertFirstKind', () => {
  it('flags TIFF and HEIC data whatever the file is called, and leaves AVIF to sharp', async () => {
    const tiff = await blank().withExif(gpsExif).tiff().toBuffer();
    expect(convertFirstKind(tiff)).toBe('TIFF data');
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic', 'latin1')]);
    expect(convertFirstKind(heic)).toBe('HEIF/HEIC data');
    const avif = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypavif', 'latin1')]);
    expect(convertFirstKind(avif)).toBeNull();
    expect(convertFirstKind(await blank().jpeg().toBuffer())).toBeNull();
  });
});
