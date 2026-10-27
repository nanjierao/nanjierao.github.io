import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Jimmy supplies the public CV PDF (no phone, no home address); it lives in public/cv/. */
export const CV_PDF_HREF = '/cv/Nanjie_Rao_CV.pdf';

/** Checked at build time: the "Download CV (PDF)" link appears only once the file exists. */
export function hasCvPdf(): boolean {
  return existsSync(join(process.cwd(), 'public', 'cv', 'Nanjie_Rao_CV.pdf'));
}
