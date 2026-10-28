// What may appear on the site. Pure functions (no astro:content) so the Vitest content
// checks apply exactly the rules the pages use.

export interface PublicationLike {
  type: 'conference' | 'extended-abstract' | 'in-preparation';
  verify: boolean;
  tldr?: { text: string; draft: boolean } | undefined;
}

/** Published work, minus anything facts.md still marks VERIFY. */
export function isListedPublication(pub: PublicationLike): boolean {
  return pub.type !== 'in-preparation' && !pub.verify;
}

/** D28 working papers appear only with Jimmy's approval (FLAGS.showWorkingPapers). */
export function isListedWorkingPaper(pub: PublicationLike, showWorkingPapers: boolean): boolean {
  return showWorkingPapers && pub.type === 'in-preparation' && !pub.verify;
}

/** The TL;DR to show, or null while it is still a DRAFT (D28). */
export function approvedTldr(pub: PublicationLike): string | null {
  return pub.tldr && !pub.tldr.draft ? pub.tldr.text : null;
}
