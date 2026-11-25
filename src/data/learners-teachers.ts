// Copy for the home page's "How AI learns about people and places" section (D66, D68), below
// its sketch scenes (whose words are in sketch-scenes.ts). Every statement comes from
// content/facts.md (§5.1, §5.2, §5.4, §5.5, §5.7, §6); tests/unit/learners-teachers.test.ts
// checks its numbers against that file. Plain data only, so the test can read every sentence
// and number the page shows. Part headings and the fixed labels are in the template.

/** The section's heading. It was "Modeling Learners and Teachers" until the scenes arrived:
 *  they also show a puppet and a city, which that title did not cover (D68). */
export const TITLE = 'How AI learns about people and places';

export const LEDE =
  'One line of work runs through these papers: I build systems that observe how people learn, and I check what those observations are worth.';

export const INTRO = [
  'What a system holds about a learner is a learner model, and a learner model is only as good as what reaches it. So I study that layer: what a system can observe about a learner, and how much of what it then says is shown in the learner’s own material.',
  'The same question has a teacher’s side: how information about students reaches teachers, and how much of the work a system should take over.',
];

export interface Step {
  title: string;
  items: Array<{ term: string; detail: string }>;
}

/** The dissertation's two studies as three steps (facts.md §5.1, §5.2). */
export const STEPS: Step[] = [
  {
    title: 'Observe',
    items: [
      {
        term: 'What students say when asked',
        detail: 'existing transcripts of sessions with an LLM tutor',
      },
      {
        term: 'Records students already produce',
        detail: 'browsing history and social-media posts',
      },
    ],
  },
  {
    title: 'Model',
    items: [
      {
        term: 'A learner model',
        detail: 'in the dissertation, a student’s interests and the information stated about each',
      },
    ],
  },
  {
    title: 'Check',
    items: [
      {
        term: 'Ask the learner',
        detail: 'in the records study, students confirmed or rejected each extracted interest',
      },
      {
        term: 'Check the source',
        detail: 'is each claim shown in the student’s material, or inferred?',
      },
      {
        term: 'Check the coding',
        detail:
          'in the asking study, two coders agreed on 90.7% of decisions on 25 double-coded transcripts (Cohen’s κ = .51)',
      },
    ],
  },
];

export const STEPS_NOTE =
  'The steps as the dissertation’s two studies ran them. The gaze and log study and the AR glasses study are in the cards below.';

export interface StudyLink {
  href: string;
  label: string;
  /** Read out after the label where several links share it, e.g. "Citation". */
  context?: string;
}

export interface Study {
  id: string;
  /** What the card is about, in a few words. */
  label: string;
  /** The work's own title, exactly as facts.md gives it. */
  title: string;
  where: string;
  /** Label of the first row; "Observed" unless the study compared conditions. */
  firstLabel?: string;
  observed: string;
  who: string;
  found: string;
  links: StudyLink[];
}

/** Section 1 (facts.md §4, §5.1, §5.4, §5.7, §6). */
export const LEARNER_STUDIES: Study[] = [
  {
    id: 'dissertation',
    label: 'The dissertation: asking students, and reading their records',
    title:
      'Toward Scalable Interest-Based Learning: Comparing Data Sources for AI-Based Automated Identification of Students’ Personal Interests',
    where: 'Dissertation, 2026',
    observed:
      'Two ways to learn a student’s interests. Asking: existing transcripts of students tutored by an interest-based LLM tutor (Dr. Abhishek Kulkarni’s dataset). Reading records: samples of each student’s browsing history and social-media posts.',
    who: 'College students: 35 in the asking study; 77 initial participants in the records study, 32 after data-quality screening.',
    found:
      'In the dissertation’s words: “Asking gives the interest in the student’s own words, teaching draws out what the student knows about it, and data sources, used with consent, add interests the student did not name.”',
    links: [{ href: '/research/interest-identification/', label: 'The dissertation in detail' }],
  },
  {
    id: 'icalt-2026',
    label: 'Browsing history compared with social-media posts',
    title:
      'Identifying Student Interests for Interest-Based Learning: A Comparison of Interest Extraction from Browsing History and Social Media Posts',
    where: 'IEEE ICALT 2026, full paper',
    observed:
      'An LLM extracted interests, with explanations, from samples of each student’s browsing history and social-media posts.',
    who: 'The dissertation’s records study. Students confirmed or rejected each extracted interest.',
    found:
      'Students confirmed 69.8% of the interests found in browsing history and 56.3% of those found in posts. Posts’ explanations carried more grounded information per confirmed interest (2.14 units compared with 1.58).',
    links: [
      { href: '/research/interest-identification/', label: 'Study and figures' },
      {
        href: '/publications/#icalt-2026-interest-extraction',
        label: 'Citation',
        context: 'IEEE ICALT 2026',
      },
    ],
  },
  {
    id: 'icids-2026',
    label: 'Gaze and interaction logs in story writing',
    title: 'Hands as Narrators: Characterizing Idea Reuptake from Hand Enactment in Story Writing',
    where: 'ICIDS 2026, full paper, accepted (to appear)',
    observed:
      'A remote web platform logged every video scrub and keystroke alongside a WebGazer.js gaze stream.',
    who: '24 participants in a two-part study.',
    found:
      'Returning to recorded hand enactments took about a quarter of writing time. The paper describes four strategies and five behaviorally inferred reasons.',
    links: [
      { href: '/research/embodied-learning/', label: 'Embodied and creative learning' },
      { href: '/builds/gaze-log-platform/', label: 'The study platform' },
      {
        href: '/publications/#icids-2026-hands-as-narrators',
        label: 'Citation',
        context: 'ICIDS 2026',
      },
    ],
  },
  {
    id: 'ieeevr-2020',
    label: 'AR smart glasses for everyday learning',
    title:
      'Investigating the Necessity of Meaningful Context Anchoring in Augmented Reality Smart Glasses Interaction for Everyday Learning',
    where: 'IEEE VR 2020, workshop paper and poster',
    firstLabel: 'Compared',
    observed:
      'Two ways for the glasses to show information: on a spoken request, or on object detection.',
    who: '25 participants in a Latin-square, within-subjects study.',
    found:
      'Showing information on a spoken request led to better learning scores. Showing it on object detection led to higher immersion and usability.',
    links: [
      { href: '/research/embodied-learning/', label: 'Embodied and creative learning' },
      { href: '/builds/ar-smart-glasses/', label: 'The two apps' },
      {
        href: '/publications/#ieeevr-2020-ar-smart-glasses',
        label: 'Citation',
        context: 'IEEE VR 2020',
      },
    ],
  },
];

/** Caption of the Study 2 figure (facts.md §5.1). */
export const SOURCES_FIGURE = {
  title:
    'Browsing history compared with social-media posts, in the dissertation’s records study (IEEE ICALT 2026)',
  note: '32 participants after data-quality screening. Students confirmed or rejected each interest the LLM extracted. Each panel has its own scale, starting at zero.',
};

/** The check behind "what those observations are worth" (facts.md §5.2, with its caveat). */
export const GROUNDING_NOTE = [
  'In the records study I also checked every unit of information the LLM stated about a student. Of 1,130 units in its explanations, 505 (44.7%) were inferred: the student’s own material did not show them.',
  'Inferred does not mean false, and an inferred claim may still be true. The check compares claims with what the student provided; it does not test truth.',
];

export const TEACHER_INTRO =
  'Three teacher-facing papers and one survey take the teacher’s side of the same question.';

export interface TeacherItem {
  lead: string;
  text: string;
  where: string;
}

/** Section 2 (facts.md §5.5, §5.7, §6). */
export const TEACHER_ITEMS: TeacherItem[] = [
  {
    lead: 'What adaptive teacher support should do.',
    text: 'Focus groups with K-12 teachers, reported as design implications for adaptive teacher support systems for more relevant instruction.',
    where: 'IEEE ICALT 2023',
  },
  {
    lead: 'Retrieving information for personalized teaching support.',
    text: 'An exploration of information retrieval for teaching support, with the PRIS system.',
    where: 'HCI International 2022, late-breaking poster',
  },
  {
    lead: 'Showing students’ information to teachers.',
    text: 'Visual efficiency in communicating students’ personally relevant information.',
    where: 'IEEE ICALT 2021',
  },
  {
    lead: 'Teacher autonomy and automation.',
    text: 'A survey of 81 studies on teacher autonomy and automation in teacher-support technologies. An update covering generative-AI systems from 2021 to 2026 is in preparation.',
    where: 'Survey',
  },
];

export const TEACHER_PUBLICATIONS = [
  'icalt-2023-context-for-contextualizing',
  'hcii-2022-information-retrieval',
  'icalt-2021-visual-efficiency',
] as const;

/** Topics in the order of the citations below them. */
export const BREADTH_INTRO =
  'Four more papers, three as a co-author and one as first author: avatars in children’s creative storytelling, explanations in recommender systems, movie recommendation from personal social media, and emotional priming in storytelling (first author).';

/** Section 3, in the order Jimmy gave (facts.md §5.4, §5.6, §6). */
export const BREADTH_PUBLICATIONS = [
  'chi-2020-self-avatars',
  'hcomp-2020-explanation-types',
  'interact-2023-everyday-inspired-movies',
  'icids-2019-emotional-priming',
] as const;
