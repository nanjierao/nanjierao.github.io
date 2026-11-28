// Blanks the metadata of photos embedded in PDFs, in place, before they are committed (D78).
// Usage: npm run strip-pdf -- <file.pdf> [...]
//
// A paper's figures are often photos that still carry EXIF (camera, time, sometimes GPS
// coordinates and a thumbnail), XMP and Photoshop blocks. This overwrites those blocks with
// zeros inside the file. The file keeps its length and its pages render as before. Run
// `npm run check:privacy` afterwards: it checks the result and prints the fingerprint that the
// reviewed file is allowlisted under.
import { readFileSync, writeFileSync } from 'node:fs';
import { blankPdfImageMetadata, pdfMetadataSignatures, scanPdfImages } from './lib/pdf-images.ts';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run strip-pdf -- <file.pdf> [...]');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const bytes = new Uint8Array(readFileSync(file));
  if (Buffer.from(bytes.subarray(0, 5)).toString('latin1') !== '%PDF-') {
    console.error(`${file}: not a PDF`);
    failed = true;
    continue;
  }
  const blanked = blankPdfImageMetadata(bytes);
  const after = scanPdfImages(bytes);
  const left = [
    ...after.jpegs.flatMap((jpeg) => jpeg.blocks.map((block) => block.kind)),
    ...pdfMetadataSignatures(bytes),
  ];
  if (blanked.length > 0) writeFileSync(file, bytes);
  console.log(
    `${file}: ${after.jpegs.length} JPEG image(s); ` +
      (blanked.length > 0 ? `blanked ${blanked.length} block(s)` : 'nothing to blank'),
  );
  for (const line of blanked) console.log(`  ${line}`);
  for (const problem of after.unhandled) {
    console.error(`  NOT HANDLED: ${problem}`);
    failed = true;
  }
  if (left.length > 0) {
    console.error(`  STILL THERE: ${[...new Set(left)].join(', ')}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
