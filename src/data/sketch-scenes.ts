// Words and structure of the sketch scenes (D68, D73): five on the home page, three teacher
// scenes on /research/teacher-support/. Every statement comes from content/facts.md (§5.1, §5.3,
// §5.4, §5.5, §7, §5.8); tests/unit/learners-teachers.test.ts reads every string here and checks
// its numbers against that file. The line drawings are in sketch-drawings.ts. Interests,
// records, reports, posts and students shown in the scenes are made up, and each scene says so.

export type SceneId =
  'tracker' | 'dorm' | 'dining' | 'puppet' | 'city' | 'views' | 'pris' | 'context';

export const SKETCH_SUBTITLE =
  'Each scene shows where the data comes from, what the system builds from it, and who checks it.';

export interface SceneGroup {
  label: string;
  scenes: SceneId[];
}

/** The home page's scene buttons, grouped by what is being observed. */
export const SCENE_GROUPS: SceneGroup[] = [
  { label: 'Learners', scenes: ['tracker', 'dorm', 'dining'] },
  { label: 'Hands', scenes: ['puppet'] },
  { label: 'City', scenes: ['city'] },
];

/** The teacher scenes, on /research/teacher-support/ (D73): one per teacher-facing paper. */
export const TEACHER_SCENE_GROUPS: SceneGroup[] = [
  { label: 'Teachers', scenes: ['views', 'pris', 'context'] },
];

/** A link from one set of scenes to the other, at the end of its row of scene buttons. */
export interface ScenesLink {
  group: string;
  label: string;
  href: string;
}

export const TEACHER_SCENES_LINK: ScenesLink = {
  group: 'Teachers',
  label: 'Three scenes on their own page',
  href: '/research/teacher-support/#scenes',
};

export const HOME_SCENES_LINK: ScenesLink = {
  group: 'Learners, hands, city',
  label: 'Five scenes on the home page',
  href: '/#learners-and-teachers',
};

export type Glyph =
  | 'search'
  | 'click'
  | 'scroll'
  | 'gaze'
  | 'laptop'
  | 'phone'
  | 'camera'
  | 'chip'
  | 'sensor'
  | 'post'
  | 'fish'
  | 'sprout'
  | 'wave'
  | 'mic'
  | 'pin'
  | 'card'
  | 'clock'
  | 'runner';

export interface Entry {
  glyph: Glyph;
  name: string;
  why: string;
  /** The sample student's answer, shown where the visitor gives none (learner scenes). */
  sample?: 'yes' | 'no';
}

export interface Step {
  /** One caption line. */
  line: string;
  /** Region of the drawing that this step draws. */
  draw?: number;
  /** Anchor in the drawing that data cards leave from, toward the panel. */
  flyFrom?: string;
  /** One card is stopped on the way: a sample that is not passed on. */
  filtered?: boolean;
  /** Rows of the panel that appear in this step. The tracker scene's label row comes after
   *  its entries, so its index is the number of entries. */
  reveal?: number[];
}

export interface Result {
  /** The number, set large. Left out for a plain sentence. */
  big?: string;
  text: string;
}

/** Tracker scene: the visitor answers the pop-up, and the answer labels the record. */
export interface AnswerTask {
  kind: 'answer';
  prompt: string;
  question: string;
  options: Array<{ value: 'yes' | 'no'; label: string; outcome: string }>;
  /** Name of the record's label row, and its text before an answer. */
  row: { name: string; waiting: string };
  sample: 'yes' | 'no';
  sampleNote: string;
}

/** Dorm and dining-hall scenes: the visitor confirms or rejects each proposed interest. */
export interface JudgeTask {
  kind: 'judge';
  prompt: string;
  yes: string;
  no: string;
  /** "{n}" and "{total}" are filled in from the visitor's marks. */
  tally: string;
  sampleNote: string;
}

/** Puppet scene: one tap turns the puppet, and the character on screen turns with it. */
export interface TurnTask {
  kind: 'turn';
  prompt: string;
  button: string;
  /** Status for the two facings, starting with the first. */
  facing: [string, string];
}

/** City scene: the visitor switches channels off and on and sees what the cell loses. */
export interface ToggleTask {
  kind: 'toggle';
  prompt: string;
  /** One per entry of the panel, in the same order; `part` names its lines in the drawing. */
  channels: Array<{ part: string; label: string }>;
  /** What the cell shows with three, two, one and no channel, in that order. */
  verdicts: [Verdict, Verdict, Verdict, Verdict];
  off: string;
}

export interface Verdict {
  label: string;
  text: string;
}

/**
 * Teacher scenes: the visitor picks one option, and the drawing and the outcome follow it. The
 * drawing's shapes for an option carry the part `pick-<value>`.
 */
export interface ChooseTask {
  kind: 'choose';
  prompt: string;
  /** Legend of the options. */
  question: string;
  options: Array<{ value: string; label: string; outcome: string }>;
  /** The option shown before the visitor picks one, and without JavaScript. */
  sample: string;
  sampleNote: string;
}

export type Task = AnswerTask | JudgeTask | TurnTask | ToggleTask | ChooseTask;

export interface Scene {
  id: SceneId;
  /** Button label: a place and a thing. */
  label: string;
  heading: string;
  /** Marks a scene that shows a prototype, made-up people, or a simulation. */
  badge?: string;
  /** Text alternative of the finished drawing. */
  alt: string;
  steps: Step[];
  panel: { title: string; empty: string; entries: Entry[] };
  task: Task;
  /** Shown once the visitor has done the hands-on step. */
  results: Result[];
  /** Results stay hidden behind this line until then. */
  locked: string;
  /** The subtitle's three questions, answered for this scene. */
  summary: { data: string; builds: string; checkedBy: string };
  source: string;
  note: string;
  /** The published paper the scene comes from (an id in src/content/publications.yaml). */
  paper?: string;
}

export const SUMMARY_LABELS = {
  data: 'Data from',
  builds: 'It builds',
  checkedBy: 'Checked by',
} as const;

/** Fixed words of the controls. */
export const CONTROLS = {
  scenes: 'Scenes',
  /** The cue before the scene buttons. */
  pick: 'Pick a scene',
  /** Before a scene's reference. */
  paper: 'Paper:',
  replay: 'Replay',
  showAll: 'Show all',
  yourTurn: 'Your turn',
  story: 'What the drawing shows',
  on: 'on',
  off: 'off',
  /** Read out after "Show all". */
  shown: 'The whole scene is shown.',
} as const;

/** The dorm scene's confirmed interests stay in the learner model when the dining-hall scene opens. */
export const CARRIED = {
  title: 'Already in the learner model, from browsing history',
  also: 'Also in the learner model, from browsing history.',
  both: {
    big: '38.2%',
    text: 'of each student’s validated interests, on average: confirmed interests the two sources added that were missing from the self-report form.',
  } satisfies Result,
  bothLocked: 'Do the dorm scene as well to see what the two sources add together.',
} as const;

const LEARNER_SOURCE =
  'Sample student, synthetic. Numbers from the dissertation’s records study (IEEE ICALT 2026), 32 participants after data-quality screening.';

const LEARNER_NOTE =
  'The student, the interests and the records in this scene are made up for illustration. Privacy protocol in the study: participant self-curation, sensitive-content filtering, non-retention.';

export const SCENES: Scene[] = [
  {
    id: 'tracker',
    label: 'Desk, browser',
    heading: 'Clicks, scrolls, searches and gaze in a browser',
    badge: 'Prototype',
    alt: 'Line drawing: a learner sits at a desk with a computer and a webcam, under a wall clock. A magnified view of the web page shows a pointer, a scroll arrow and a ring where the learner is looking. A small pop-up sits on the screen.',
    steps: [
      { line: 'A desk with a computer and a webcam.', draw: 0 },
      { line: 'A learner reads on the web.', draw: 1 },
      {
        line: 'A browser extension, the Tracker Toolbox, logs clicks, scrolls and searches, and follows gaze through the webcam with WebGazer.js.',
        draw: 2,
      },
      {
        line: 'It maps each record to the page content it touched.',
        flyFrom: 'lens',
        reveal: [0, 1, 2, 3],
      },
      {
        line: 'Once a minute, a pop-up asks the learner about that minute.',
        draw: 3,
        reveal: [4],
      },
      { line: 'The learner’s answer labels that minute of the record.' },
    ],
    panel: {
      title: 'One minute of the record',
      empty: 'Nothing logged yet.',
      entries: [
        { glyph: 'search', name: 'Search', why: 'typed “how do suspension bridges stay up”' },
        { glyph: 'click', name: 'Click', why: 'opened an article about suspension bridges' },
        { glyph: 'scroll', name: 'Scroll', why: 'reached the part about the main cables' },
        { glyph: 'gaze', name: 'Gaze', why: 'rested on the diagram of the towers' },
      ],
    },
    task: {
      kind: 'answer',
      prompt: 'You are the learner. Answer the pop-up.',
      question: 'Did you learn something in the last minute?',
      options: [
        { value: 'yes', label: 'Yes', outcome: 'Yes, I learned something.' },
        { value: 'no', label: 'No', outcome: 'No, I did not learn anything.' },
      ],
      row: { name: 'Self-report', waiting: 'no answer yet' },
      sample: 'yes',
      sampleNote: 'A sample answer is shown.',
    },
    results: [
      {
        text: 'The log shows what the learner did. The answer to the pop-up is the learner’s own word on that minute.',
      },
    ],
    locked: 'Answer the pop-up to label the record.',
    summary: {
      data: 'Clicks, scrolls, searches and gaze, logged by a Chrome extension',
      builds: 'A record of each minute, mapped to the page content',
      checkedBy: 'The learner, in a self-report once a minute',
    },
    source: 'Tracker Toolbox, a Chrome extension. Unpublished prototype.',
    note: 'The records in this scene are made up for illustration, and the pop-up’s question is an example.',
  },
  {
    id: 'dorm',
    label: 'Dorm, laptop',
    heading: 'Browsing history on a dorm laptop',
    badge: 'Synthetic sample',
    alt: 'Line drawing: a student sits at a desk in a dorm room with a laptop and a mug, next to a bed, a window and a shelf. A magnified view shows a browser window with several tabs.',
    steps: [
      { line: 'A dorm room in the evening.', draw: 0 },
      { line: 'A student sits down at the desk.', draw: 1 },
      { line: 'Their browsing history holds traces of what they care about.', draw: 2 },
      {
        line: 'They choose which samples of it to share.',
        flyFrom: 'lens',
        filtered: true,
      },
      {
        line: 'An LLM reads the samples and extracts interests, each with an explanation. Sensitive content is left out.',
        reveal: [0, 1, 2, 3],
      },
      { line: 'The student confirms or rejects each one.' },
    ],
    panel: {
      title: 'The tutor’s learner model',
      empty: 'No interests yet.',
      entries: [
        {
          glyph: 'laptop',
          name: 'bouldering',
          why: 'visited a climbing gym’s pages and route videos',
          sample: 'yes',
        },
        {
          glyph: 'laptop',
          name: 'film photography',
          why: 'searched for film stocks and a lab nearby',
          sample: 'yes',
        },
        { glyph: 'laptop', name: 'home espresso', why: 'read grinder reviews', sample: 'yes' },
        { glyph: 'laptop', name: 'car insurance', why: 'compared quotes', sample: 'no' },
      ],
    },
    task: {
      kind: 'judge',
      prompt: 'You are the student. Confirm or reject each interest.',
      yes: 'Confirm',
      no: 'Reject',
      tally: 'You confirmed {n} of {total}.',
      sampleNote: 'The sample student’s answers are shown where you gave none.',
    },
    results: [
      {
        big: '69.8%',
        text: 'of the interests extracted from browsing history were confirmed by the students in the study.',
      },
    ],
    locked: 'Mark all four to see what the students in the study did.',
    summary: {
      data: 'Samples of browsing history that the student chose to share',
      builds: 'A learner model: the student’s interests, each with an explanation',
      checkedBy: 'The student, who confirms or rejects each interest',
    },
    source: LEARNER_SOURCE,
    note: LEARNER_NOTE,
    paper: 'icalt-2026-interest-extraction',
  },
  {
    id: 'dining',
    label: 'Dining hall, phone',
    heading: 'Social-media posts on a phone',
    badge: 'Synthetic sample',
    alt: 'Line drawing: a student eats at a long table in a dining hall and holds a phone. A magnified view of the phone shows two posts, one with a picture and one with a heart.',
    steps: [
      { line: 'Lunch in the dining hall.', draw: 0 },
      { line: 'The same student, eating between classes.', draw: 1 },
      { line: 'Between bites, they scroll and post on social media.', draw: 2 },
      {
        line: 'They choose which posts to share.',
        flyFrom: 'lens',
        filtered: true,
      },
      {
        line: 'An LLM reads the posts and extracts interests, each with an explanation. Sensitive content is left out.',
        reveal: [0, 1, 2, 3],
      },
      { line: 'The student confirms or rejects each one.' },
    ],
    panel: {
      title: 'The tutor’s learner model',
      empty: 'No interests yet.',
      entries: [
        {
          glyph: 'phone',
          name: 'bouldering',
          why: 'posted a video of a finished route',
          sample: 'yes',
        },
        {
          glyph: 'phone',
          name: 'dumplings',
          why: 'posted homemade dumplings with the recipe',
          sample: 'yes',
        },
        { glyph: 'phone', name: 'anime', why: 'reposted one meme', sample: 'no' },
        { glyph: 'phone', name: 'a friend’s band', why: 'shared one gig flyer', sample: 'no' },
      ],
    },
    task: {
      kind: 'judge',
      prompt: 'You are the student. Confirm or reject each interest.',
      yes: 'Confirm',
      no: 'Reject',
      tally: 'You confirmed {n} of {total}.',
      sampleNote: 'The sample student’s answers are shown where you gave none.',
    },
    results: [
      {
        big: '56.3%',
        text: 'of the interests extracted from posts were confirmed, a smaller share than from browsing history.',
      },
      {
        big: '2.14',
        text: 'grounded units of information per confirmed interest in the posts’ explanations, compared with 1.58 for browsing history.',
      },
    ],
    locked: 'Mark all four to see what the students in the study did.',
    summary: {
      data: 'Samples of social-media posts that the student chose to share',
      builds: 'The same learner model, with more grounded information per confirmed interest',
      checkedBy: 'The student, who confirms or rejects each interest',
    },
    source: LEARNER_SOURCE,
    note: LEARNER_NOTE,
    paper: 'icalt-2026-interest-extraction',
  },
  {
    id: 'puppet',
    label: 'Classroom, puppet',
    heading: 'A puppet tracked by a camera and a motion sensor',
    alt: 'Line drawing: a storyteller at a classroom table holds up a small puppet in front of a camera, next to a laptop. A magnified view of the laptop screen shows a cartoon character facing the same way as the puppet.',
    steps: [
      { line: 'A classroom table with a camera and a laptop.', draw: 0 },
      { line: 'A storyteller moves a 3D-printed puppet in front of the camera.', draw: 1 },
      {
        line: 'The camera tracks where the puppet is. A motion sensor on it tracks how it turns.',
        draw: 2,
      },
      {
        line: 'A YOLO detector finds the puppet’s position in the camera image.',
        flyFrom: 'camera',
        reveal: [0],
      },
      {
        line: 'An IMU on the puppet reports its rotation over Bluetooth.',
        flyFrom: 'chip',
        reveal: [1],
      },
      { line: 'On screen, the digital puppet moves with the real one.' },
    ],
    panel: {
      title: 'The digital puppet',
      empty: 'No tracking yet.',
      entries: [
        { glyph: 'camera', name: 'Where it is', why: 'position, from a YOLO detector' },
        {
          glyph: 'chip',
          name: 'How it turns',
          why: 'rotation, from an IMU on the puppet, over Bluetooth',
        },
      ],
    },
    task: {
      kind: 'turn',
      prompt: 'Turn the puppet and watch the character on the screen.',
      button: 'Turn the puppet',
      facing: [
        'The puppet faces right. The character on screen faces right.',
        'The puppet faces left. The character on screen faces left too.',
      ],
    },
    results: [
      {
        text: 'The turn reaches the screen through the IMU, and the position through the camera. Unity animates the character in real time.',
      },
    ],
    locked: 'Turn the puppet once to see how the turn travels.',
    summary: {
      data: 'A camera image, and a motion sensor (IMU) on a 3D-printed puppet',
      builds: 'A digital puppet, animated in Unity in real time',
      checkedBy: 'A perception study with 23 MTurk workers',
    },
    source:
      'Puppet storytelling system, built for the NSF project To Enact, To Tell, To Write (HCII 2021).',
    note: 'The drawing is an illustration, not a picture of the system.',
    paper: 'hcii-2021-puppet-system',
  },
  {
    id: 'city',
    label: 'Street, flood',
    heading: 'A flooded street, seen through three channels',
    badge: 'Simulated',
    alt: 'Line drawing: a street with two houses under rain and flood water. A resident with an umbrella holds a phone next to a sensor post. A magnified view shows a map grid with one cell marked, and lines run to it from the sensor, the phone and a card that stands for a social post.',
    steps: [
      { line: 'A street during a hurricane flood.', draw: 0 },
      { line: 'A resident steps outside with a phone.', draw: 1 },
      {
        line: 'An official sensor, citizen reports and social posts all point at cells of one map.',
        draw: 2,
      },
      {
        line: 'The official sensor shows an anomaly in this cell.',
        flyFrom: 'sensor',
        reveal: [0],
      },
      {
        line: 'A social post reports flooding in the same cell. An LLM parses it into a hazard event.',
        flyFrom: 'post',
        reveal: [1],
      },
      {
        line: 'Two channels agree, so nearby residents get a one-tap verification quest. A citizen report from the same cell makes three.',
        flyFrom: 'phone',
        reveal: [2],
      },
      { line: 'When all three channels agree in one cell, the event is confirmed.' },
    ],
    panel: {
      title: 'One cell of the city’s digital twin',
      empty: 'No channel has reported yet.',
      entries: [
        { glyph: 'sensor', name: 'Official sensor', why: 'an anomaly in this cell' },
        { glyph: 'post', name: 'Social post', why: 'a post from this cell, parsed by an LLM' },
        { glyph: 'phone', name: 'Citizen report', why: 'a resident’s report, parsed by an LLM' },
      ],
    },
    task: {
      kind: 'toggle',
      prompt: 'Switch a channel off and see what the cell loses.',
      channels: [
        { part: 'sensor', label: 'Official sensor' },
        { part: 'social', label: 'Social post' },
        { part: 'citizen', label: 'Citizen report' },
      ],
      verdicts: [
        {
          label: 'Confirmed',
          text: 'All three channels agree in this cell, so the event is confirmed.',
        },
        {
          label: 'Verification quest',
          text: 'Two channels agree. Nearby residents get a one-tap verification quest, and the event is not confirmed yet.',
        },
        {
          label: 'Not confirmed',
          text: 'One channel alone meets neither rule, so the cell stays unconfirmed.',
        },
        { label: 'No data', text: 'No channel reports from this cell.' },
      ],
      off: 'switched off',
    },
    results: [
      {
        big: '10.8 hours',
        text: 'into a 30-hour simulated replay modeled on Hurricane Irma, three channels first agreed in one cell.',
      },
      { text: 'At the storm’s peak the replay had four confirmed cells and three open quests.' },
    ],
    locked: 'Switch a channel off or on to see the replay’s numbers.',
    summary: {
      data: 'An official sensor, citizen reports and social posts',
      builds: 'A cell of the city’s digital twin, confirmed when three channels agree',
      checkedBy: 'Nearby residents, through a one-tap verification quest',
    },
    source:
      'CS-UDT flood prototype for Jacksonville (DTRUE 2026, with Jatin Verma and Ava Prator).',
    note: 'Everything in this scene is simulated: the replay is modeled on a past hurricane, and the reports and posts are synthetic.',
    paper: 'dtrue-2026-csudt-framework',
  },
  {
    id: 'views',
    label: 'Classroom, tablet',
    heading: 'A student’s experiences, shown to the teacher three ways',
    badge: 'Synthetic sample',
    alt: 'Line drawing: a teacher stands in a classroom and holds a tablet, while a student at a desk raises a hand. A magnified view of the tablet shows what the student has experienced: as lines of text, as a mind map or as a small picture, depending on the view picked.',
    steps: [
      { line: 'A classroom in the middle of a lesson.', draw: 0 },
      { line: 'A student raises a hand, and the teacher turns to them.', draw: 1 },
      {
        line: 'On a tablet, the teacher looks at what this student has experienced, to link the lesson to it.',
        draw: 2,
      },
      {
        line: 'The same information can be shown as plain text, as a mind map or as a story illustration.',
        flyFrom: 'tablet',
        reveal: [0, 1, 2],
      },
      { line: 'Which view does the teacher take in fastest, and with the least effort?' },
    ],
    panel: {
      title: 'What this student has experienced',
      empty: 'Nothing shown yet.',
      entries: [
        { glyph: 'fish', name: 'fishing trips', why: 'goes fishing with a grandparent' },
        { glyph: 'sprout', name: 'a vegetable garden', why: 'grows tomatoes at home' },
        { glyph: 'wave', name: 'a trip to the coast', why: 'saw tide pools last summer' },
      ],
    },
    task: {
      kind: 'choose',
      prompt: 'You are the teacher. Pick a view of the student’s experiences.',
      question: 'Show them as',
      options: [
        {
          value: 'text',
          label: 'Plain text',
          outcome: 'Plain text: one sentence per experience, to read in turn.',
        },
        {
          value: 'map',
          label: 'Mind map',
          outcome: 'Mind map: the student in the middle, and one branch per experience.',
        },
        {
          value: 'story',
          label: 'Story illustration',
          outcome: 'Story illustration: the three experiences drawn as one small scene.',
        },
      ],
      sample: 'text',
      sampleNote: 'A sample view is shown.',
    },
    results: [
      {
        text: 'In the study, the story illustration, and to a lesser extent the mind map, lowered the mental effort and the time needed to take in the information.',
      },
    ],
    locked: 'Pick a view to see what the study found.',
    summary: {
      data: 'A student’s personally relevant information, such as their experiences',
      builds: 'A view of it for the teacher: plain text, a mind map or a story illustration',
      checkedBy: 'A within-subjects study of response accuracy, response time and mental effort',
    },
    source: 'Three visualizations compared in a hypothetical teaching scenario (IEEE ICALT 2021).',
    note: 'The classroom, the tablet, the student and the experiences in this scene are made up for illustration.',
    paper: 'icalt-2021-visual-efficiency',
  },
  {
    id: 'pris',
    label: 'Classroom, Kinect',
    heading: 'A teacher’s words, heard by a Kinect and matched to students',
    badge: 'Synthetic sample',
    alt: 'Line drawing: a teacher walks between tables of students in a classroom and talks. A Kinect sensor under the board picks up what the teacher says and follows where the teacher stands, marked by a ring on the floor. A speech bubble shows a picture of what the teacher talks about, and the students it matches are highlighted at their table.',
    steps: [
      { line: 'A classroom with tables of students.', draw: 0 },
      { line: 'A teacher walks between the tables and talks.', draw: 1 },
      {
        line: 'A Kinect sensor picks up what the teacher says and where the teacher stands.',
        draw: 2,
      },
      {
        line: 'Speech recognition turns the teacher’s words into text, in real time.',
        flyFrom: 'kinect',
        reveal: [0, 1],
      },
      {
        line: 'PRIS looks up students’ personal information that relates to those words.',
        reveal: [2],
      },
      { line: 'The teacher can bring what it finds into the lesson.' },
    ],
    panel: {
      title: 'What PRIS works with',
      empty: 'Nothing picked up yet.',
      entries: [
        { glyph: 'mic', name: 'Speech', why: 'the teacher’s words, recognized as text' },
        {
          glyph: 'pin',
          name: 'Position',
          why: 'where the teacher stands in the classroom, from the Kinect',
        },
        {
          glyph: 'card',
          name: 'Students',
          why: 'their personal information that relates to the words',
        },
      ],
    },
    task: {
      kind: 'choose',
      prompt: 'You are the teacher. Pick what you say next.',
      question: 'Say',
      options: [
        {
          value: 'volcano',
          label: '“Today: volcanoes.”',
          outcome:
            'PRIS finds two students: one hiked up a volcano on a family trip, one built a model volcano.',
        },
        {
          value: 'pizza',
          label: '“Let’s cut a pizza into eighths.”',
          outcome: 'PRIS finds a student who helps at a family pizza shop on weekends.',
        },
        {
          value: 'bees',
          label: '“Who has seen a beehive?”',
          outcome: 'PRIS finds a student whose family keeps bees.',
        },
      ],
      sample: 'volcano',
      sampleNote: 'A sample is shown.',
    },
    results: [
      {
        text: 'In the study, PRIS was compared with notecards. With PRIS, usability was better, the teacher’s cognitive load was lower, and personalized teaching happened more often.',
      },
    ],
    locked: 'Pick what the teacher says to see what the study found.',
    summary: {
      data: 'The teacher’s speech and position in the classroom, from a Kinect',
      builds: 'In real time, students’ personal information that relates to what the teacher says',
      checkedBy: 'A study that compared PRIS with notecards',
    },
    source: 'PRIS, a real-time system for personalized teaching support (HCI International 2022).',
    note: 'The classroom, what the teacher says, the students and their information in this scene are made up for illustration.',
    paper: 'hcii-2022-information-retrieval',
  },
  {
    id: 'context',
    label: 'Staff room, focus group',
    heading: 'What teachers draw on to make a lesson relevant',
    badge: 'Synthetic sample',
    alt: 'Line drawing: teachers sit around a table in a staff room and talk, with a lesson plan in the middle. Three speech bubbles above them hold a clock, a running figure and a map pin; the bubble of the kind of context picked is highlighted.',
    steps: [
      { line: 'A staff room after school.', draw: 0 },
      { line: 'Teachers meet in a focus group, with a lesson plan on the table.', draw: 1 },
      { line: 'They describe how they link a lesson to their students’ lives.', draw: 2 },
      {
        line: 'Three kinds of context stand out: time, activity and location.',
        flyFrom: 'bubbles',
        reveal: [0, 1, 2],
      },
      { line: 'Each ties the lesson to what students have experienced.' },
    ],
    panel: {
      title: 'The context for contextualizing',
      empty: 'Nothing named yet.',
      entries: [
        { glyph: 'clock', name: 'Time', why: 'for example, the week of the first frost' },
        { glyph: 'runner', name: 'Activity', why: 'for example, a weekend soccer game' },
        { glyph: 'pin', name: 'Location', why: 'for example, the river on the way to school' },
      ],
    },
    task: {
      kind: 'choose',
      prompt: 'Pick a kind of context to see how it could tie a lesson to students.',
      question: 'Context',
      options: [
        {
          value: 'time',
          label: 'Time',
          outcome:
            'For example, a lesson on ice and water in the week of the first frost, when students have just seen ice on the windows.',
        },
        {
          value: 'activity',
          label: 'Activity',
          outcome:
            'For example, a lesson on speed and distance, linked to the soccer game many students played at the weekend.',
        },
        {
          value: 'location',
          label: 'Location',
          outcome:
            'For example, a lesson on erosion, linked to the river students cross on the way to school.',
        },
      ],
      sample: 'time',
      sampleNote: 'A sample is shown.',
    },
    results: [
      {
        text: 'From the focus groups, the paper identifies three categories of context, time, activity and location, each tied to the lesson and to students’ prior experiences.',
      },
      {
        text: 'The paper turns them into design implications for adaptive teacher support systems.',
      },
    ],
    locked: 'Pick a kind of context to see what the focus groups found.',
    summary: {
      data: 'Focus groups with teachers',
      builds:
        'Three categories of context, and design implications for adaptive teacher support systems',
      checkedBy:
        'This site has no record of a separate check of the categories; they come from what the teachers described',
    },
    source: 'Focus groups with teachers on making instruction relevant (IEEE ICALT 2023).',
    note: 'The staff room, the teachers and the examples in this scene are made up for illustration.',
    paper: 'icalt-2023-context-for-contextualizing',
  },
];
