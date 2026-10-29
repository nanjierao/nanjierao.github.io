// Numbers behind the figures on the research pages, transcribed from content/facts.md (section
// noted on each block). `display` is the text the figure shows; tests/unit/figures.test.ts checks
// that every display string appears in facts.md and that the parts add up.

export interface Datum {
  value: number;
  display: string;
}

export interface Metric {
  label: string;
  /** Upper end of the bar scale; bars always start at zero. */
  max: number;
  /** One value per series, in series order. */
  values: Datum[];
  note?: string;
}

export type SegmentKind = 'grounded' | 'inferred' | 'focus' | 'rest';

export interface Segment extends Datum {
  /** Empty when facts.md doesn't state the count (the bar still shows the remainder). */
  display: string;
  label: string;
  kind: SegmentKind;
  /** Shown after the label, e.g. "(44.7%)", only where facts.md states the share. */
  share?: string;
}

export interface SplitRow {
  label: string;
  total: Datum & { unit: string };
  segments: Segment[];
}

export interface Stat {
  value: string;
  label: string;
}

/** facts.md §5.1, Study 2 (IEEE ICALT 2026): browsing history vs. social-media posts. */
export const STUDY2_SOURCES = {
  facts: '5.1',
  series: ['Browsing history', 'Social-media posts'],
  metrics: [
    {
      label: 'Interests students confirmed (precision)',
      max: 100,
      values: [
        { value: 69.8, display: '69.8%' },
        { value: 56.3, display: '56.3%' },
      ],
    },
    {
      label: 'Overlap with what students reported themselves (Jaccard)',
      max: 1,
      values: [
        { value: 0.44, display: '.44' },
        { value: 0.24, display: '.24' },
      ],
    },
    {
      label: 'Grounded units in the LLM’s explanations, per confirmed interest',
      max: 2.5,
      values: [
        { value: 1.58, display: '1.58' },
        { value: 2.14, display: '2.14' },
      ],
      note: 'p = .023',
    },
  ] satisfies Metric[],
} as const;

/** facts.md §5.1, Study 2: who took part and what the two sources added together. */
export const STUDY2_STATS: Stat[] = [
  { value: '77 → 32', label: 'participants, before and after data-quality screening' },
  { value: '.31', label: 'overlap between the two sources (Jaccard)' },
  {
    value: '38.2%',
    label:
      'of each student’s validated interests, on average: confirmed interests the two sources added that were missing from the self-report form',
  },
];

/** facts.md §5.1, Study 1: what students said when the tutor asked. */
export const STUDY1_STATS: Stat[] = [
  { value: '35', label: 'college students tutored by an interest-based LLM tutor' },
  { value: '2.5', label: 'units, on average, in the reply to the tutor’s opening question' },
  { value: '29%', label: 'said nothing beyond the interest’s name' },
  {
    value: '12 of 35',
    label: 'participants’ disclosures placed the interest in an individual (later) phase',
  },
];

/** facts.md §5.1, Study 1: share of units that were knowledge of the interest's domain. */
export const STUDY1_KNOWLEDGE: SplitRow[] = [
  {
    label: 'Reply to the tutor’s opening question',
    total: { value: 86, display: '86', unit: 'units' },
    segments: [
      { value: 9, display: '9', label: 'domain knowledge', kind: 'focus', share: '(10%)' },
      { value: 77, display: '', label: 'other information', kind: 'rest' },
    ],
  },
  {
    label: 'Added later, while using the interest in teaching',
    total: { value: 33, display: '33', unit: 'units from 14 participants' },
    segments: [
      { value: 29, display: '29', label: 'domain knowledge', kind: 'focus', share: '(88%)' },
      { value: 4, display: '', label: 'other information', kind: 'rest' },
    ],
  },
];

/** facts.md §5.2: grounded vs. inferred units in what models asserted about students. */
export const GROUNDING: SplitRow[] = [
  {
    label: 'Study 2 extractor: 384 explanations',
    total: { value: 1130, display: '1,130', unit: 'units' },
    segments: [
      { value: 625, display: '625', label: 'grounded', kind: 'grounded' },
      { value: 505, display: '505', label: 'inferred', kind: 'inferred', share: '(44.7%)' },
    ],
  },
  {
    label: 'Study 1 tutor (dissertation Appendix E)',
    total: { value: 57, display: '57', unit: 'units' },
    segments: [
      { value: 23, display: '23', label: 'grounded', kind: 'grounded', share: '(40.4%)' },
      { value: 34, display: '34', label: 'inferred', kind: 'inferred', share: '(59.6%)' },
    ],
  },
];

/** facts.md §5.3: the simulated replay. */
export const CSUDT_REPLAY = {
  facts: '5.3',
  hours: 30,
  firstConfirmation: { value: 10.8, display: '10.8' },
  peak: { confirmedCells: 'four', openQuests: 'three' },
} as const;

/** facts.md §5.3: the six dimensions of Sense–Engage–Govern. */
export const SEG_DIMENSIONS = [
  'contribution mode',
  'twin coupling',
  'incentive substrate',
  'verification locus',
  'temporal regime',
  'access threshold',
] as const;
