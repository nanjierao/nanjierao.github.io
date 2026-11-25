// The Experiments page, /research/experiments/ (D74): the controlled experiments behind the
// work, one row per study. Every cell is content/facts.md §5.10 (Jimmy, Nov 25, 2026), word for
// word apart from typographic apostrophes; tests/unit/experiments.test.ts holds the rows to
// that table. The citations and their links come from src/content/publications.yaml.
import { SCENES } from './sketch-scenes.ts';

export interface ExperimentRow {
  /** The study's paper in publications.yaml: its citation and DOI link. */
  paper?: string;
  /** In place of a paper, the dissertation (facts.md §4), cited the same way. */
  study?: { authors: string[]; year: number; title: string; venue: string };
  /** A short note under the citation. */
  note?: string;
  role: string;
  design: string;
  participants: string;
  comparison: string;
  analysis: string;
}

/**
 * The sketch scenes drawn from a paper (D68, D73), each linked so that it opens on its own. All
 * of them are on the home page (D76).
 */
export function scenesFor(paper: string | undefined): Array<{ href: string; label: string }> {
  if (!paper) return [];
  return SCENES.filter((scene) => scene.paper === paper).map((scene) => ({
    href: `/#sk-${scene.id}`,
    label: scene.label,
  }));
}

export const TITLE = 'Experiments';

export const DESCRIPTION =
  'The controlled experiments behind my work: for each study, what was compared, with whom, how it was controlled and how it was analyzed.';

/** Two or three sentences in the first person (Jimmy's request of Nov 25, 2026). */
export const INTRO: string[] = [
  'I design and run controlled experiments. I ran six of them as first author and co-authored three more, and the table shows how each one was controlled and analyzed.',
  'When I use AI in research, every reported number is re-derived from the data, every claim traces to a source, and every decision is logged.',
];

export const CAPTION =
  'Controlled experiments: first-author studies, then co-authored ones, newest first in each group.';

export const COLUMNS = ['Study', 'My role', 'Design', 'Participants', 'Comparison', 'Analysis'];

export const GROUPS = { first: 'First-author studies', co: 'Co-authored studies' } as const;

/** facts.md §5.10, first table, in its order (newest first). */
export const FIRST_AUTHOR: ExperimentRow[] = [
  {
    paper: 'icalt-2026-interest-extraction',
    note: 'Dissertation Study 2',
    role: 'First author',
    design: 'Within-subjects; each participant gave both samples, in random order',
    participants: '32 college students, retained of 77 after data-quality screening',
    comparison:
      'Browsing history vs. social media posts, with a self-reported list as the baseline',
    analysis:
      'Paired t-tests with Wilcoxon signed-rank checks; precision 69.8% vs. 56.3%, paired t(31) = 8.59',
  },
  {
    // TODO(jimmy): the dissertation's UF Digital Collections link once it is released.
    study: {
      authors: ['Rao, N.'],
      year: 2026,
      title:
        'Toward Scalable Interest-Based Learning: Comparing Data Sources for AI-Based Automated Identification of Students’ Personal Interests',
      venue: 'Ph.D. dissertation, University of Florida',
    },
    note: 'Dissertation Study 1, a secondary analysis',
    role: 'Secondary analysis',
    design:
      'My analysis of a colleague’s within-subjects experiment: each student met an interest-based and a generic tutor; tutor order alternated across enrollment; each student’s two topics were randomly assigned to the tutors',
    participants: '35 undergraduate computer-science majors',
    comparison: 'How much students told the tutor about their interests vs. four session outcomes',
    analysis:
      'ANCOVA adjusted for the same student’s generic-session score and condition order, with Benjamini–Hochberg adjustment; reported as an association',
  },
  {
    paper: 'hcii-2022-information-retrieval',
    role: 'First author',
    design: 'Within-subjects; condition order and topics counterbalanced',
    participants: '8 participants teaching simulated online classes',
    comparison: 'PRIS vs. normal notecards (usual practice)',
    analysis: 'Paired t-tests',
  },
  {
    paper: 'icalt-2021-visual-efficiency',
    note: 'Short paper',
    role: 'First author',
    design:
      'Within-subjects; topics, visualizations and virtual students randomized across conditions',
    participants: '70 university students',
    comparison: 'Plain text (baseline) vs. graphical mind map vs. story illustration',
    analysis: 'One-way ANOVAs with Tukey HSD on response time, response accuracy and mental effort',
  },
  {
    paper: 'hcii-2021-puppet-system',
    role: 'First author',
    design:
      'Online 2 × 2 mixed design; puppetry type within participants, order counterbalanced; story design between participants',
    participants: '23 valid MTurk responses of 54',
    comparison: 'Physical puppet enactment vs. the system’s virtual animation',
    analysis: 'Two-way mixed ANOVA',
  },
  {
    // TODO(jimmy): a DOI or publisher link for this paper (facts.md §6 [12] has none).
    paper: 'ieeevr-2020-ar-smart-glasses',
    note: 'Workshop paper',
    role: 'First author',
    design: 'Within-subjects, counterbalanced',
    participants: '25 analyzed of 30',
    comparison: 'Object-triggered vs. speech-triggered learning app on smart glasses',
    // The analysis method only. facts.md §5.10 also gives this row's results (the quiz scores,
    // t(24) = 5.06, and the 17 of 25 who preferred the object-triggered app), but older studies
    // show their design only, and the quiz scores read the other way round from §5.4.
    // TODO(jimmy): which app scored 52.9 on the quiz, and which 38.9?
    analysis: 'Paired t-tests',
  },
  {
    // TODO(jimmy): a DOI or publisher link for this paper (facts.md §6 [9] has none).
    paper: 'icids-2019-emotional-priming',
    role: 'First author',
    design: 'Within-subjects; condition order counterbalanced, story prompts randomized',
    participants: '12 participants',
    comparison: 'Two interactive emotional-priming conditions vs. no priming',
    analysis: 'ANOVA and paired t-tests',
  },
];

/** facts.md §5.10, second table: Jimmy's author position, never that he led them. */
export const CO_AUTHORED: ExperimentRow[] = [
  {
    paper: 'interact-2023-everyday-inspired-movies',
    role: 'Fourth author',
    design: 'Within-subjects; presentation order random',
    participants: '21 participants',
    comparison: 'System recommendations vs. a human-judgment baseline',
    analysis: 'Paired t-tests',
  },
  {
    // TODO(jimmy): a DOI or publisher link for this paper (facts.md §6 [7] has none).
    paper: 'hcomp-2020-explanation-types',
    role: 'Third author',
    design:
      'Online mixed design; motivation scenario randomly assigned between participants; explanation type within participants, order randomized',
    participants: '78 participants',
    comparison: 'Explanation types under three motivation scenarios',
    analysis: 'Mixed ANOVA',
  },
  {
    // TODO(jimmy): a DOI or publisher link for this paper (facts.md §6 [8] has none).
    paper: 'chi-2020-self-avatars',
    role: 'Fourth author',
    design: 'Within-subjects, counterbalanced',
    participants: '16 children aged 8 to 12 (20 recruited)',
    comparison: 'Self-avatar vs. story-relevant avatar',
    analysis: 'Repeated-measures ANOVA',
  },
];

/** facts.md §9 (Jimmy, Nov 25, 2026): also on /about and /cv. */
export const MENTORING_REVIEWING: string[] = [
  'I mentor undergraduate, master’s, and PhD students and review their research projects from study design to analysis.',
  'I have reviewed papers for the journal Computers & Education and for the IDC, ICIDS, and TEI conferences.',
];

/** The two notes under the table (Jimmy's wording, in the first person). */
export const NOTES = [
  {
    id: 'claims',
    title: 'What I claim from these designs',
    text: [
      'The experiments compare conditions within participants, in counterbalanced or randomized order. One co-authored study, AAAI HCOMP 2020, assigned participants to conditions at random. My dissertation’s Study 1 reports an association, not an effect, because what students disclosed was not assigned.',
    ],
  },
  {
    id: 'mentoring',
    title: 'Mentoring and reviewing',
    text: MENTORING_REVIEWING,
  },
];

/** The home page's line in its Research section, and the research overview's. */
export const SUMMARY_LINE =
  'I have run six controlled experiments as first author and three more as co-author.';
export const LINK_LABEL = 'How each one was controlled';
export const HREF = '/research/experiments/';
