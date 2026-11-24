// The rules of facts.md §5.9 and CLAUDE.md content rule 12 as patterns, held without a list of
// the names, which would publish them. content.test.ts runs them over every text about the class
// study; notes.test.ts runs them over each line of a daily note that mentions a study or a course.

/** Venue and year, as the lists of works write them: not a course number. */
export const VENUE_YEAR = /\b(?:CHI|ICER) 20\d{2}\b/g;

export const CLASS_STUDY_FORBIDDEN: ReadonlyArray<readonly [what: string, pattern: RegExp]> = [
  // Three letters and four digits, however written: "ABC 1234", "abc-1234", "ABC1234C".
  [
    'a course number',
    /(?<![A-Za-z])[A-Za-z]{3}[\s-]*(?!(?:19|20)\d{2}(?!\d))\d{4}[A-Za-z]?(?![A-Za-z\d])/,
  ],
  ['a course number', /(?<![A-Za-z])[A-Z]{3}[\s-]*\d{4}[A-Za-z]?(?![A-Za-z\d])/],
  ['a person with a title', /\b(?:Dr|Prof|Professor|Mr|Mrs|Ms|Mx)\.?\s+\p{Lu}/u],
  ['an email address', /[\w.+-]+@[\w-]+\.[\w.]+/],
  ['a review-board or protocol number', /\bIRB|\b[A-Z]{2,4}\s?#?\s?\d{5,}\b|\bprotocol\s+\S*\d/],
  ['an ID number', /(?<!\d)\d{4}-?\d{4}(?!\d)/],
  [
    'a head count',
    /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:students?|co-authors?|authors?|participants?|people|classmates?)\b/i,
  ],
  [
    'who has joined',
    /\b(?:has|have|had)\s+(?:signed\s+up|joined|enrolled|agreed|declined|withdrawn)\b|\bsigned\s+up\b|\benrolled\b|\bwithdrew\b/i,
  ],
];
