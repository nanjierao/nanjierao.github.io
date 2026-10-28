// Strip EXIF, XMP, IPTC and other metadata from images before they are committed (D31,
// facts.md §15): npm run strip-images -- path/to/photo.jpg [more files]
// Pixels are re-encoded in the same format; the camera orientation is applied first so the
// picture still faces the right way.
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import sharp from 'sharp';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run strip-images -- <image files>');
  process.exit(1);
}

for (const file of files) {
  const input = await readFile(file);
  const ext = extname(file).toLowerCase();
  let image = sharp(input).rotate();
  if (ext === '.jpg' || ext === '.jpeg') image = image.jpeg({ quality: 90, mozjpeg: true });
  else if (ext === '.png') image = image.png({ compressionLevel: 9 });
  else if (ext === '.webp') image = image.webp({ quality: 90 });
  else if (ext === '.avif') image = image.avif({ quality: 70 });
  else {
    console.error(`${file}: unsupported type; convert it to JPEG, PNG, WebP or AVIF first`);
    process.exitCode = 1;
    continue;
  }
  await writeFile(file, await image.toBuffer());
  console.log(`${file}: metadata removed`);
}
