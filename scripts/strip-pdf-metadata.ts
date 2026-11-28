// Blanks the metadata of photos embedded in PDFs, in place, before they are committed (D78).
// Usage: npm run strip-pdf -- <file.pdf> [...]
//
// A paper's figures are often photos that still carry EXIF (camera, time, sometimes GPS
// coordinates and a thumbnail), XMP and Photoshop blocks. This overwrites those blocks with
// zeros inside the file. The file keeps its length and its pages render as before. Run
// `npm run check:privacy` afterwards: it checks the result and prints the fingerprint that the
// reviewed file is allowlisted under.
import { readFileSync, writeFileSync } from 'node:fs';
import { blankPdfImageMetadata, isPdf, pdfPhotoFindings, scanPdfImages } from './lib/pdf-images.ts';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run strip-pdf -- <file.pdf> [...]');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const bytes = new Uint8Array(readFileSync(file));
  if (!isPdf(bytes)) {
    console.error(`${file}: not a PDF`);
    failed = true;
    continue;
  }
  const blanked = blankPdfImageMetadata(bytes);
  const images = scanPdfImages(bytes).jpegs.length;
  const after = pdfPhotoFindings(bytes);
  if (blanked.length > 0) writeFileSync(file, bytes);
  console.log(
    `${file}: ${images} JPEG image(s); ` +
      (blanked.length > 0 ? `blanked ${blanked.length} block(s)` : 'nothing to blank'),
  );
  for (const line of blanked) console.log(`  ${line}`);
  // What the tool cannot vouch for: someone has to look at these before the file is committed.
  for (const problem of after.unhandled) {
    console.error(`  NOT HANDLED: ${problem}`);
    failed = true;
  }
  if (after.metadata.length > 0) {
    console.error(`  STILL THERE: ${after.metadata.join(', ')}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
