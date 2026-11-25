// The home page's "How AI learns about people and places" section (D66, D68) and the teacher
// scenes of /research/teacher-support/ (D73): every sentence and number they show comes from two
// data modules, the sketch scenes' and the text below them, so the checks here cover both (part
// headings and fixed labels are in the components; the end-to-end tests read the rendered
// pages). Numbers must be in content/facts.md and stay with the study facts.md gives them to,
// the term is "learner model", and the copy has no em dashes.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import * as page from '../../src/data/learners-teachers.ts';
import * as sketch from '../../src/data/sketch-scenes.ts';
import { CANVAS, DRAWINGS } from '../../src/data/sketch-drawings.ts';
import { GLYPHS } from '../../src/data/sketch-glyphs.ts';
import { NAV } from '../../src/data/site.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const FACTS = readFileSync(join(ROOT, 'content', 'facts.md'), 'utf8').replace(/\*\*/g, '');
/** facts.md on one line, without emphasis marks, for matching sentences and titles. */
const FACTS_LINE = FACTS.replace(/[*_]/g, '').replace(/\s+/g, ' ');
/** The page uses typographic apostrophes; facts.md uses straight ones. */
const plain = (text: string) => text.replace(/’/g, "'");

/** Every string in the module, however deeply nested. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/** Sentences and labels, without paths and one-word keys. */
const copyOf = (module: unknown) =>
  // Keys such as "tracker" or "cell-hatch" are not copy; a value made of digits ("77") is.
  strings(module).filter((text) => !text.startsWith('/') && !/^[a-z-]+$/.test(text));
const COPY = [...copyOf(page), ...copyOf(sketch)];
const LINKS = strings(page).filter((text) => text.startsWith('/'));

/** The numbers a sentence shows, as written (single digits are counts of things on screen). */
const numbersIn = (text: string) =>
  (text.match(/(?<![\w.])(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?|\.\d+)/g) ?? []).filter(
    (n) => !/^\d$/.test(n),
  );
const inText = (number: string, text: string) =>
  new RegExp(`(?<![\\d.,])${number.replace(/[.]/g, '\\.')}(?![\\d])`).test(text);

describe('copy of the home page section and its sketch scenes', () => {
  it('shows only numbers that are in facts.md', () => {
    for (const text of COPY) {
      for (const number of numbersIn(text)) {
        expect(inText(number, FACTS), `"${number}" in "${text}" is not in facts.md`).toBe(true);
      }
    }
  });

  it('says "learner model" and never "world model"', () => {
    const all = COPY.join(' ');
    expect(all).toContain('learner model');
    expect(all).not.toMatch(/world model/i);
  });

  it('has no em dashes, markers or words CLAUDE.md rules out', () => {
    for (const text of COPY) {
      expect(text).not.toContain('—');
      expect(text).not.toMatch(/TODO|VERIFY|DRAFT/);
      expect(text).not.toMatch(/\b(passionate|cutting-edge|leverage|innovative)\b/i);
    }
  });

  it('keeps the §5.2 caveat next to the inferred share', () => {
    const note = page.GROUNDING_NOTE.join(' ');
    expect(note).toContain('44.7%');
    expect(note).toContain('Inferred does not mean false');
    expect(note).toContain('does not test truth');
  });

  it('quotes the dissertation takeaway word for word', () => {
    const quote = /“([^”]+)”/.exec(page.LEARNER_STUDIES[0]!.found)![1]!;
    expect(FACTS_LINE).toContain(plain(quote));
  });

  it('gives every work its own title, exactly as facts.md has it', () => {
    for (const study of page.LEARNER_STUDIES) {
      expect(FACTS_LINE, study.id).toContain(plain(study.title));
      expect(study.label, study.id).not.toBe(study.title);
    }
  });

  it('keeps each number with the study and the meaning facts.md gives it', () => {
    const [dissertation, icalt, icids, ieeevr] = page.LEARNER_STUDIES;
    const coding = page.STEPS[2]!.items[2]!.detail;
    const pinned: Array<[inFacts: RegExp, copy: string, inCopy: RegExp]> = [
      [/transcripts of 35 college students/, dissertation!.who, /35 in the asking study/],
      [
        /77 initial participants, 32 retained after data-quality screening/,
        dissertation!.who,
        /77 initial participants in the records study, 32 after data-quality screening/,
      ],
      [
        /Browsing history had higher precision: 69\.8% confirmed vs\. 56\.3% for posts/,
        icalt!.found,
        /69\.8% of the interests found in browsing history and 56\.3% of those found in posts/,
      ],
      [
        /Posts' explanations carried more grounded information per confirmed interest \(2\.14 vs\. 1\.58/,
        icalt!.found,
        /Posts’ explanations carried more grounded information .*\(2\.14 units compared with 1\.58\)/,
      ],
      [/Hands as Narrators \(ICIDS 2026.{0,200}?N = 24/, icids!.who, /^24 participants/],
      [/took about a quarter of writing time/, icids!.found, /about a quarter of writing time/],
      [
        /IEEE VR 2020\): Latin-square within-subjects study, N = 25/,
        ieeevr!.who,
        /^25 participants/,
      ],
      [
        /1,130 units . 625 grounded and 505 \(44\.7%\) inferred/,
        page.GROUNDING_NOTE[0]!,
        /Of 1,130 units in its explanations, 505 \(44\.7%\) were inferred/,
      ],
      [
        /Study 1 \(asking\).*two coders; on 25 double-coded transcripts they agreed on 90\.7% of 700 code-by-transcript decisions; code-level Cohen's κ = \.51/,
        coding,
        /^in the asking study, two coders agreed on 90\.7% of decisions on 25 double-coded transcripts \(Cohen’s κ = \.51\)$/,
      ],
      [
        /Survey of 81 studies on teacher autonomy vs\. automation/,
        page.TEACHER_ITEMS[3]!.text,
        /^A survey of 81 studies on teacher autonomy and automation/,
      ],
      [
        /32 retained after data-quality screening/,
        page.SOURCES_FIGURE.note,
        /^32 participants after/,
      ],
    ];
    for (const [inFacts, copy, inCopy] of pinned) {
      expect(FACTS_LINE, String(inFacts)).toMatch(inFacts);
      expect(copy).toMatch(inCopy);
    }
  });

  it('credits the dataset the asking study used, and scopes the diagram to the dissertation', () => {
    expect(page.LEARNER_STUDIES[0]!.observed).toContain('existing transcripts');
    expect(page.LEARNER_STUDIES[0]!.observed).toContain('Dr. Abhishek Kulkarni’s dataset');
    expect(FACTS_LINE).toContain("Dr. Abhishek Kulkarni's dataset");
    const diagram = page.STEPS.flatMap((step) => step.items.map((item) => item.detail)).join(' ');
    expect(diagram).not.toMatch(/gaze|keystroke/);
    expect(page.STEPS_NOTE).toContain('dissertation');
  });
});

describe('sketch scenes (D68)', () => {
  const scene = (id: sketch.SceneId) => sketch.SCENES.find((item) => item.id === id)!;
  const words = (id: sketch.SceneId) => strings(scene(id)).join(' ');
  /** One numbered section of facts.md, from its heading to the next one. */
  const section = (number: string) => {
    const start = FACTS.indexOf(`### ${number} `);
    const end = FACTS.indexOf('\n##', start + 1);
    return FACTS.slice(start, end);
  };

  it('has the title, the subtitle, the five home scenes Jimmy set, and the three teacher scenes', () => {
    expect(page.TITLE).toBe('How AI learns about people and places');
    expect(sketch.SKETCH_SUBTITLE).toBe(
      'Each scene shows where the data comes from, what the system builds from it, and who checks it.',
    );
    expect(sketch.SCENES.map((item) => item.id)).toEqual([
      'tracker',
      'dorm',
      'dining',
      'puppet',
      'city',
      'views',
      'pris',
      'context',
    ]);
    expect(sketch.SCENE_GROUPS).toEqual([
      { label: 'Learners', scenes: ['tracker', 'dorm', 'dining'] },
      { label: 'Hands', scenes: ['puppet'] },
      { label: 'City', scenes: ['city'] },
    ]);
    // The teacher scenes are on a page of their own (D73): the home page's budget has no room
    // for them. Every scene is in one set or the other.
    expect(sketch.TEACHER_SCENE_GROUPS).toEqual([
      { label: 'Teachers', scenes: ['views', 'pris', 'context'] },
    ]);
    const home = sketch.SCENE_GROUPS.flatMap((group) => group.scenes);
    const teachers = sketch.TEACHER_SCENE_GROUPS.flatMap((group) => group.scenes);
    expect([...home, ...teachers]).toEqual(sketch.SCENES.map((item) => item.id));
    // Each set links to the other, and the teacher support page is the one that shows them.
    expect(sketch.TEACHER_SCENES_LINK.href).toBe('/research/teacher-support/#scenes');
    expect(sketch.HOME_SCENES_LINK.href).toBe('/#learners-and-teachers');
    const theme = readFileSync(
      join(ROOT, 'src', 'content', 'themes', 'teacher-support.md'),
      'utf8',
    );
    expect(theme).toMatch(/^scenes: teachers$/m);
    expect(sketch.CONTROLS.pick).toBe('Pick a scene');
  });

  it('marks the prototype, the made-up student and the simulation on screen', () => {
    expect(scene('tracker').badge).toBe('Prototype');
    expect(scene('dorm').badge).toBe('Synthetic sample');
    expect(scene('dining').badge).toBe('Synthetic sample');
    expect(scene('city').badge).toBe('Simulated');
    expect(scene('tracker').source).toContain('Unpublished prototype');
    for (const id of ['tracker', 'dorm', 'dining'] as const)
      expect(scene(id).note, id).toContain('made up');
    // The pop-up's wording is the scene's own; facts.md does not record the extension's.
    expect(scene('tracker').note).toContain('the pop-up’s question is an example');
    expect(scene('city').note).toMatch(/^Everything in this scene is simulated/);
    expect(scene('puppet').note).toContain('illustration');
    // The teacher scenes' students, experiences, words and examples are made up (facts.md §5.8).
    for (const id of ['views', 'pris', 'context'] as const) {
      expect(scene(id).badge, id).toBe('Synthetic sample');
      expect(scene(id).note, id).toMatch(/are made up for illustration\.$/);
    }
  });

  it('shows no numbers in the prototype scene', () => {
    expect(words('tracker')).not.toMatch(/\d/);
  });

  it('keeps each number with the meaning facts.md gives it', () => {
    const results = (id: sketch.SceneId) =>
      scene(id)
        .results.map((result) => `${result.big ?? ''} ${result.text}`)
        .join(' ');
    const both = `${sketch.CARRIED.both.big} ${sketch.CARRIED.both.text}`;
    const pinned: Array<[inFacts: RegExp, copy: string, inCopy: RegExp]> = [
      [
        /Browsing history had higher precision: 69\.8% confirmed vs\. 56\.3% for posts/,
        results('dorm'),
        /^69\.8% of the interests extracted from browsing history were confirmed/,
      ],
      [
        /69\.8% confirmed vs\. 56\.3% for posts/,
        results('dining'),
        /^56\.3% of the interests extracted from posts were confirmed, a smaller share than from browsing history/,
      ],
      [
        /Posts' explanations carried more grounded information per confirmed interest \(2\.14 vs\. 1\.58 grounded units/,
        results('dining'),
        /2\.14 grounded units of information per confirmed interest in the posts’ explanations, compared with 1\.58 for browsing history/,
      ],
      [
        /Together they added confirmed interests missing from the self-report form: 38\.2% of each participant's validated interests on average/,
        both,
        /^38\.2% of each student’s validated interests, on average: confirmed interests the two sources added that were missing from the self-report form/,
      ],
      [/32 retained after data-quality screening/, scene('dorm').source, /32 participants after/],
      [
        /first three-channel confirmation 10\.8 hours into a 30-hour replay/,
        results('city'),
        /^10\.8 hours into a 30-hour simulated replay modeled on Hurricane Irma, three channels first agreed in one cell/,
      ],
      [
        /at the storm's peak, four confirmed cells and three open quests/,
        results('city'),
        /At the storm’s peak the replay had four confirmed cells and three open quests/,
      ],
      [
        /perception study with 23 MTurk workers/,
        scene('puppet').summary.checkedBy,
        /^A perception study with 23 MTurk workers$/,
      ],
    ];
    for (const [inFacts, copy, inCopy] of pinned) {
      expect(FACTS_LINE, String(inFacts)).toMatch(inFacts);
      expect(copy).toMatch(inCopy);
    }
    // facts.md §5.1 retires "self-report missed 38%".
    expect(strings(sketch).join(' ')).not.toMatch(/self-report (form )?missed/i);
    // The privacy protocol in facts.md's own three terms, and nothing stronger than them.
    expect(FACTS_LINE).toContain(
      'Privacy protocol: participant self-curation, sensitive-content filtering, non-retention.',
    );
    for (const id of ['dorm', 'dining'] as const) {
      expect(scene(id).note, id).toContain(
        'Privacy protocol in the study: participant self-curation, sensitive-content filtering, non-retention.',
      );
      expect(words(id), id).not.toMatch(/nothing is kept|never stored|deleted/i);
    }
  });

  it('takes the flood scene’s numbers from facts.md §5.3 only, and names no coauthor', () => {
    const civic = section('5.3');
    expect(civic).toContain('Simulated replay modeled on Hurricane Irma');
    for (const text of strings(scene('city')))
      for (const number of numbersIn(text))
        expect(inText(number, civic), `"${number}" in "${text}" is not in §5.3`).toBe(true);
    // The author list waits on Jimmy's check of the extended abstract (facts.md §5.3, VERIFY).
    // The authors as facts.md §5.3 gives them since Nov 25, 2026 (D46).
    expect(words('city')).toContain('with Jatin Verma and Ava Prator');
  });

  it('describes the puppet system and the tracker as facts.md §7 does', () => {
    expect(FACTS_LINE).toMatch(
      /position from a YOLO detector.*rotation from BBC micro:bit and Aimxy IMUs over Bluetooth/,
    );
    expect(words('puppet')).toMatch(/position, from a YOLO detector/);
    expect(words('puppet')).toMatch(/rotation, from an IMU on the puppet, over Bluetooth/);
    expect(FACTS_LINE).toMatch(
      /logs clicks, scrolls, searches and WebGazer\.js gaze, maps them to page content, and asks learners two self-report questions every 60 seconds/,
    );
    expect(words('tracker')).toMatch(/logs clicks, scrolls and searches, and follows gaze/);
    expect(words('tracker')).toContain('Did you learn something in the last minute?');
    expect(words('tracker')).not.toMatch(/competition|placed|finalist|award/i);
  });

  it('gives every scene one hands-on step, with sample answers for the finished view', () => {
    expect(sketch.SCENES.map((item) => item.task.kind)).toEqual([
      'answer',
      'judge',
      'judge',
      'turn',
      'toggle',
      'choose',
      'choose',
      'choose',
    ]);
    // A pick: a few options with their own outcomes, one of them the sample. The values name
    // parts of the drawing and lines of the page, so they are single lowercase words.
    for (const item of sketch.SCENES) {
      const { task } = item;
      if (task.kind !== 'choose') continue;
      const values = task.options.map((option) => option.value);
      expect(values.length, item.id).toBeGreaterThanOrEqual(2);
      expect(new Set(values).size, item.id).toBe(values.length);
      for (const value of values) expect(value, item.id).toMatch(/^[a-z]+$/);
      expect(values, item.id).toContain(task.sample);
      const labels = task.options.map((option) => option.label);
      const outcomes = task.options.map((option) => option.outcome);
      expect(new Set(labels).size, item.id).toBe(labels.length);
      expect(new Set(outcomes).size, item.id).toBe(outcomes.length);
    }
    for (const id of ['dorm', 'dining'] as const)
      for (const entry of scene(id).panel.entries)
        expect(entry.sample, `${id}: ${entry.name}`).toMatch(/^(yes|no)$/);
    const city = scene('city');
    if (city.task.kind !== 'toggle') throw new Error('the city scene toggles channels');
    expect(city.task.channels).toHaveLength(city.panel.entries.length);
    expect(city.task.verdicts).toHaveLength(city.panel.entries.length + 1);
    // One interest appears in both learner scenes: the notebook keeps it across them.
    const names = (id: sketch.SceneId) => scene(id).panel.entries.map((entry) => entry.name);
    expect(names('dining').filter((name) => names('dorm').includes(name))).toEqual(['bouldering']);
  });

  it('matches its captions to the drawings: every region and every panel row appears once', () => {
    for (const item of sketch.SCENES) {
      const drawing = DRAWINGS[item.id];
      const drawn = item.steps.flatMap((step) => (step.draw === undefined ? [] : [step.draw]));
      expect(drawn, `${item.id}: regions`).toEqual(drawing.regions.map((_, index) => index));
      const rows = item.panel.entries.length + (item.task.kind === 'answer' ? 1 : 0);
      const revealed = item.steps.flatMap((step) => step.reveal ?? []).sort((a, b) => a - b);
      expect(revealed, `${item.id}: rows`).toEqual(Array.from({ length: rows }, (_, i) => i));
      for (const step of item.steps)
        if (step.flyFrom) expect(drawing.anchors[step.flyFrom], step.flyFrom).toBeDefined();
      for (const entry of item.panel.entries) expect(GLYPHS[entry.glyph]).toBeDefined();
      // The last caption introduces the visitor's step, so nothing draws under it.
      expect(item.steps.at(-1)!.draw, item.id).toBeUndefined();
    }
  });

  it('has the parts that the hands-on steps move, and drawings made of path data only', () => {
    const parts = (id: sketch.SceneId) =>
      new Set(
        DRAWINGS[id].regions.flatMap((region) =>
          region.shapes.flatMap((shape) => (shape.part ? [shape.part] : [])),
        ),
      );
    for (const part of ['puppet', 'avatar']) {
      expect(parts('puppet').has(part), part).toBe(true);
      expect(DRAWINGS.puppet.anchors[part], part).toBeDefined();
    }
    const city = scene('city');
    if (city.task.kind !== 'toggle') throw new Error('the city scene toggles channels');
    for (const channel of city.task.channels)
      expect(parts('city').has(channel.part), channel.part).toBe(true);
    for (const part of ['cell', 'cell-tick', 'cell-hatch'])
      expect(parts('city').has(part), part).toBe(true);
    // A pick shows the option picked in the drawing: each option has parts of its own, and no
    // other scene has such parts.
    for (const item of sketch.SCENES) {
      const picks = [...parts(item.id)].filter((part) => part.startsWith('pick-')).sort();
      const options =
        item.task.kind === 'choose'
          ? item.task.options.map((option) => `pick-${option.value}`)
          : [];
      expect(picks, item.id).toEqual(options.sort());
    }
    for (const [id, drawing] of Object.entries(DRAWINGS)) {
      for (const region of drawing.regions) {
        expect(region.ms, id).toBeGreaterThan(0);
        for (const shape of region.shapes) {
          expect(shape.d, id).toMatch(/^M[MLCZ\d ,.-]+$/);
          expect(Boolean(shape.fill) !== Boolean(shape.stroke), `${id}: ${shape.d}`).toBe(true);
          // Every point is on the 800 × 450 canvas: x then y, in pairs.
          const numbers = (shape.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
          expect(numbers.length % 2, `${id}: ${shape.d}`).toBe(0);
          numbers.forEach((value, index) => {
            expect(value, `${id}: ${shape.d}`).toBeGreaterThanOrEqual(0);
            expect(value, `${id}: ${shape.d}`).toBeLessThanOrEqual(
              index % 2 === 0 ? CANVAS.width : CANVAS.height,
            );
          });
        }
      }
    }
  });
});

describe('the papers the scenes come from, and the teacher scenes (D73)', () => {
  const scene = (id: sketch.SceneId) => sketch.SCENES.find((item) => item.id === id)!;
  const words = (id: sketch.SceneId) => strings(scene(id)).join(' ');
  const publications = parseYaml(
    readFileSync(join(ROOT, 'src', 'content', 'publications.yaml'), 'utf8'),
  ) as Array<{
    id: string;
    type: string;
    verify?: boolean;
    year?: number;
    venue: string;
    url?: string;
    award?: string;
  }>;
  const listed = (id: string) =>
    publications.find((pub) => pub.id === id && pub.type !== 'in-preparation' && !pub.verify);

  it('names the paper of every scene that comes from one, and it is listed on the site', () => {
    expect(Object.fromEntries(sketch.SCENES.map((item) => [item.id, item.paper ?? null]))).toEqual({
      tracker: null,
      dorm: 'icalt-2026-interest-extraction',
      dining: 'icalt-2026-interest-extraction',
      puppet: 'hcii-2021-puppet-system',
      city: 'dtrue-2026-csudt-framework',
      views: 'icalt-2021-visual-efficiency',
      pris: 'hcii-2022-information-retrieval',
      context: 'icalt-2023-context-for-contextualizing',
    });
    for (const item of sketch.SCENES) {
      if (!item.paper) continue;
      const paper = listed(item.paper);
      expect(paper, item.id).toBeDefined();
      // The scene's source line names the same work: its year, at least.
      expect(item.source, item.id).toContain(String(paper!.year));
    }
  });

  it('links each paper to its DOI as facts.md §6 gives it, and DTRUE 2026 to nothing yet', () => {
    for (const pub of publications) {
      if (!pub.url) continue;
      const doi = /^https:\/\/doi\.org\/(10\.\d{4,}\/\S+)$/.exec(pub.url);
      expect(doi, pub.id).not.toBeNull();
      expect(FACTS.replace(/\s+/g, ' '), pub.id).toContain(`DOI ${doi![1]}`);
    }
    for (const id of [
      'icalt-2026-interest-extraction',
      'hcii-2021-puppet-system',
      'icalt-2021-visual-efficiency',
      'hcii-2022-information-retrieval',
      'icalt-2023-context-for-contextualizing',
    ])
      expect(listed(id)!.url, id).toMatch(/^https:\/\/doi\.org\//);
    // No link was found for the DTRUE 2026 extended abstract; it is cited without one.
    expect(listed('dtrue-2026-csudt-framework')!.url).toBeUndefined();
  });

  it('gives the teacher papers only the recognition facts.md §5.5 allows', () => {
    expect(listed('icalt-2021-visual-efficiency')!.award).toBe('Best Short Paper Nomination');
    expect(listed('icalt-2023-context-for-contextualizing')!.award).toBeUndefined();
    expect(listed('hcii-2022-information-retrieval')!.award).toBeUndefined();
    expect(FACTS_LINE).toContain(
      "Recognition: mention only ICALT 2021's Best Short Paper Nomination; no award for ICALT 2023",
    );
    for (const id of ['views', 'pris', 'context'] as const)
      expect(words(id), id).not.toMatch(/award|best paper|nominat|mention/i);
  });

  it('keeps the teacher scenes to what facts.md §5.5 says the papers did and found', () => {
    const results = (id: sketch.SceneId) =>
      scene(id)
        .results.map((result) => `${result.big ?? ''} ${result.text}`)
        .join(' ');
    const pinned: Array<[inFacts: RegExp, copy: string, inCopy: RegExp]> = [
      [
        /three visualizations of students' personal relevant information \(plain text, a graphical mind map, a story illustration\) in a hypothetical teaching scenario/,
        `${words('views')}`,
        /plain text, as a mind map or as a story illustration/,
      ],
      [
        /visual efficiency measured as response accuracy, response time and mental effort/,
        scene('views').summary.checkedBy,
        /^A within-subjects study of response accuracy, response time and mental effort$/,
      ],
      [
        /the story illustration and, to a lesser extent, the mind map lowered mental effort and the time needed to take in the information/,
        results('views'),
        /the story illustration, and to a lesser extent the mind map, lowered the mental effort and the time needed to take in the information/,
      ],
      [
        /PRIS, a real-time system for personalized teaching support/,
        scene('pris').source,
        /^PRIS, a real-time system for personalized teaching support \(HCI International 2022\)\.$/,
      ],
      [
        /compared with notecards, it showed better usability, lower teacher cognitive load and more frequent personalized teaching behaviors/,
        results('pris'),
        /PRIS was compared with notecards\. With PRIS, usability was better, the teacher’s cognitive load was lower, and personalized teaching happened more often/,
      ],
      [
        /It used a Kinect for speech and position recognition in a classroom/,
        words('pris'),
        /A Kinect sensor picks up what the teacher says and where the teacher stands/,
      ],
      [
        /focus groups with teachers about contextualizing; three categories of context \(time, activity, location\), tied to the lesson and to students' prior experiences; design implications for adaptive teacher support systems/,
        results('context'),
        /^ The focus groups named three categories of context, time, activity and location, each tied to the lesson and to students’ prior experiences\..*design implications for adaptive teacher support systems/,
      ],
    ];
    for (const [inFacts, copy, inCopy] of pinned) {
      expect(FACTS_LINE, String(inFacts)).toMatch(inFacts);
      expect(copy).toMatch(inCopy);
    }
    // No numbers of their own: the papers' numbers are not in facts.md.
    for (const id of ['views', 'pris', 'context'] as const)
      for (const text of strings(scene(id)))
        expect(text.replace(/\b(2021|2022|2023)\b/g, ''), `${id}: ${text}`).not.toMatch(/\d/);
  });
});

describe('publications and links in the learners-and-teachers section', () => {
  const publications = parseYaml(
    readFileSync(join(ROOT, 'src', 'content', 'publications.yaml'), 'utf8'),
  ) as Array<{ id: string; type: string; verify?: boolean; firstAuthor: boolean }>;
  const listed = (id: string) =>
    publications.find((pub) => pub.id === id && pub.type !== 'in-preparation' && !pub.verify);

  it('lists the papers in the order of the outline, all of them published and listed', () => {
    expect([...page.TEACHER_PUBLICATIONS]).toEqual([
      'icalt-2023-context-for-contextualizing',
      'hcii-2022-information-retrieval',
      'icalt-2021-visual-efficiency',
    ]);
    expect([...page.BREADTH_PUBLICATIONS]).toEqual([
      'chi-2020-self-avatars',
      'hcomp-2020-explanation-types',
      'interact-2023-everyday-inspired-movies',
      'icids-2019-emotional-priming',
    ]);
    for (const id of [...page.TEACHER_PUBLICATIONS, ...page.BREADTH_PUBLICATIONS]) {
      expect(listed(id), id).toBeDefined();
    }
    // "three of them as a co-author"
    expect(page.BREADTH_PUBLICATIONS.filter((id) => !listed(id)!.firstAuthor)).toHaveLength(3);
  });

  it('links only to pages and citations that exist', () => {
    expect(LINKS.length).toBeGreaterThan(5);
    for (const link of LINKS) {
      const [path, anchor] = link.split('#') as [string, string | undefined];
      const research = /^\/research\/([a-z0-9-]+)\/$/.exec(path);
      const build = /^\/builds\/([a-z0-9-]+)\/$/.exec(path);
      if (research) {
        const base = join(ROOT, 'src', 'content', 'themes', research[1]!);
        expect(existsSync(`${base}.md`) || existsSync(`${base}.mdx`), link).toBe(true);
      } else if (build) {
        expect(existsSync(join(ROOT, 'src', 'content', 'builds', `${build[1]}.md`)), link).toBe(
          true,
        );
      } else {
        expect(path, link).toBe('/publications/');
        expect(listed(anchor!), link).toBeDefined();
      }
    }
  });

  it('is a section of the home page, with no tab of its own', () => {
    expect(NAV.map((item) => item.href)).toEqual([
      '/research/',
      '/publications/',
      '/builds/',
      '/teaching/',
      '/cv/',
      '/blog/',
      '/about/',
    ]);
    expect(existsSync(join(ROOT, 'src', 'pages', 'learners-and-teachers.astro'))).toBe(false);
    const home = readFileSync(join(ROOT, 'src', 'pages', 'index.astro'), 'utf8');
    expect(home.indexOf('<WordCloud />')).toBeLessThan(home.indexOf('<LearnersTeachers />'));
    expect(home.indexOf('<LearnersTeachers />')).toBeLessThan(
      home.indexOf('id="research-heading"'),
    );
    // The scenes sit after the lede and before the "Observe, model, check" figure (D68).
    const part = readFileSync(join(ROOT, 'src', 'components', 'LearnersTeachers.astro'), 'utf8');
    // With a link to the teacher scenes at the end of its row of scene buttons (D73).
    const scenes = '<SketchScenes link={TEACHER_SCENES_LINK} />';
    expect(part.indexOf('{LEDE}')).toBeGreaterThan(-1);
    expect(part.indexOf('{LEDE}')).toBeLessThan(part.indexOf(scenes));
    expect(part.indexOf(scenes)).toBeLessThan(
      part.indexOf('<Figure title="Observe, model, check"'),
    );
    expect(part).toContain('id="learners-and-teachers"');
  });

  it('ships the scenes without React, and with no new dependency', () => {
    // React's client runtime alone is larger than the page's JavaScript budget (D68).
    const scenes = readFileSync(join(ROOT, 'src', 'components', 'SketchScenes.astro'), 'utf8');
    // Only the markup counts: the component's comments explain why there is no island.
    const markup = scenes.slice(scenes.indexOf('---', 3));
    expect(markup).not.toMatch(/client:(load|idle|visible|only|media)/);
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@astrojs/mdx',
      '@astrojs/react',
      '@astrojs/rss',
      '@astrojs/sitemap',
      '@fontsource-variable/inter',
      '@fontsource-variable/source-serif-4',
      '@fontsource/ibm-plex-mono',
      'astro',
      'd3-cloud',
      'fast-xml-parser',
      'react',
      'react-dom',
    ]);
  });
});
