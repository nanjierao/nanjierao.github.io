// Copy for /learners-and-teachers/ (D66). Every statement comes from content/facts.md (§5.1, §5.2,
// §5.4, §5.5, §5.7, §6); tests/unit/learners-teachers.test.ts checks its numbers against that file.
// Plain data only, so the test can read every string the page shows.

export const TITLE = 'Modeling Learners and Teachers';

export const DESCRIPTION =
  'One line of work by Nanjie (Jimmy) Rao: systems that observe how people learn, and checks of what those observations are worth.';

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

/** The line of work as three steps (facts.md §5.1, §5.2, §5.4). */
export const STEPS: Step[] = [
  {
    title: 'Observe',
    items: [
      { term: 'What students say when asked', detail: 'sessions with an LLM tutor' },
      {
        term: 'Records students already produce',
        detail: 'browsing history and social-media posts',
      },
      { term: 'What people do while they work', detail: 'gaze, video scrubs and keystrokes' },
    ],
  },
  {
    title: 'Model',
    items: [
      {
        term: 'A learner model',
        detail: 'here, a student’s interests and the information stated about each',
      },
    ],
  },
  {
    title: 'Check',
    items: [
      {
        term: 'Ask the learner',
        detail: 'students confirmed or rejected each extracted interest',
      },
      {
        term: 'Check the source',
        detail: 'is each claim shown in the student’s material, or inferred?',
      },
      { term: 'Check the coding', detail: 'two coders, with agreement reported' },
    ],
  },
];

export interface Study {
  id: string;
  title: string;
  where: string;
  observed: string;
  who: string;
  found: string;
  links: Array<{ href: string; label: string }>;
}

/** Section 1 (facts.md §5.1, §5.4, §5.7). */
export const LEARNER_STUDIES: Study[] = [
  {
    id: 'dissertation',
    title:
      'Toward Scalable Interest-Based Learning: Comparing Data Sources for AI-Based Automated Identification of Students’ Personal Interests',
    where: 'Dissertation, 2026',
    observed:
      'Two ways to learn a student’s interests: asking, in sessions with an interest-based LLM tutor, and reading samples of the student’s browsing history and social-media posts.',
    who: 'College students: 35 in the asking study; 77 initial participants in the records study, 32 after data-quality screening.',
    found:
      'In the dissertation’s words: “Browsing history suits finding the right interest, posts suit learning about it, and both suit covering more interests.”',
    links: [{ href: '/research/interest-identification/', label: 'The dissertation in detail' }],
  },
  {
    id: 'icalt-2026',
    title: 'Browsing history compared with social-media posts',
    where: 'IEEE ICALT 2026, full paper',
    observed:
      'An LLM extracted interests, with explanations, from samples of each student’s browsing history and social-media posts.',
    who: 'The dissertation’s records study. Students confirmed or rejected each extracted interest.',
    found:
      'Students confirmed 69.8% of the interests found in browsing history and 56.3% of those found in posts. Posts’ explanations carried more grounded information per confirmed interest (2.14 units compared with 1.58).',
    links: [
      { href: '/research/interest-identification/', label: 'Study and figures' },
      { href: '/publications/#icalt-2026-interest-extraction', label: 'Citation' },
    ],
  },
  {
    id: 'icids-2026',
    title: 'Hands as Narrators: gaze and interaction logs in story writing',
    where: 'ICIDS 2026, full paper, accepted (to appear)',
    observed:
      'A remote web platform logged every video scrub and keystroke alongside a WebGazer.js gaze stream.',
    who: '24 participants in a two-part study.',
    found:
      'Returning to recorded hand enactments took about a quarter of writing time. The paper describes four strategies and five behaviorally inferred reasons.',
    links: [
      { href: '/research/embodied-learning/', label: 'Embodied and creative learning' },
      { href: '/builds/gaze-log-platform/', label: 'The study platform' },
      { href: '/publications/#icids-2026-hands-as-narrators', label: 'Citation' },
    ],
  },
  {
    id: 'ieeevr-2020',
    title: 'AR smart glasses for everyday learning',
    where: 'IEEE VR 2020, workshop paper and poster',
    observed:
      'Two ways for the glasses to show information: on a spoken request, or on object detection.',
    who: '25 participants in a Latin-square, within-subjects study.',
    found:
      'Showing information on a spoken request led to better learning scores. Showing it on object detection led to higher immersion and usability.',
    links: [
      { href: '/research/embodied-learning/', label: 'Embodied and creative learning' },
      { href: '/builds/ar-smart-glasses/', label: 'The two apps' },
      { href: '/publications/#ieeevr-2020-ar-smart-glasses', label: 'Citation' },
    ],
  },
];

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
    text: 'Visual efficiency in communicating students’ personally relevant information. A Best Short Paper Nomination.',
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

export const BREADTH_INTRO =
  'Four more papers, three of them as a co-author: avatars in children’s creative storytelling, emotional priming in storytelling, explanations in recommender systems, and movie recommendation from personal social media.';

/** Section 3, in the order Jimmy gave (facts.md §5.4, §5.6, §6). */
export const BREADTH_PUBLICATIONS = [
  'chi-2020-self-avatars',
  'hcomp-2020-explanation-types',
  'interact-2023-everyday-inspired-movies',
  'icids-2019-emotional-priming',
] as const;

export const MORE_INTRO =
  'The CV lists everything in one place, and the publications page has the full citations.';
