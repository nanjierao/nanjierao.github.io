// Content schemas, shared by src/content.config.ts and the Vitest content checks.
// Image fields take a validator so tests can substitute a plain string check for Astro's
// `image()` helper, which only exists inside the collection config.
import { z } from 'astro/zod';
import { hasLoneBoldMarker, noteLead, noteText } from '../lib/notes.ts';

/** Astro's `image()` in the collection config; a plain validator in tests. */
type ImageValidator<T extends z.ZodType> = () => T;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Use YYYY-MM-DD' });
/** Year, year-month, or full date: content dates are only as precise as facts.md. */
const partialDate = z
  .string()
  .regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/, { error: 'Use YYYY, YYYY-MM or YYYY-MM-DD' });

/** Where a fact came from, e.g. "5.1" for content/facts.md §5.1. */
const factsRefs = z.array(z.string().regex(/^\d+(?:\.\d+)?$/)).min(1);

export const CONTEXTS = ['personal', 'embodied', 'civic'] as const;
export const CONTEXT_LABELS: Record<(typeof CONTEXTS)[number], string> = {
  personal: 'Personal',
  embodied: 'Embodied',
  civic: 'Civic',
};

/** Label of the group that lists studies still running (D69), after the three contexts. */
export const ONGOING_LABEL = 'Ongoing';

/**
 * Research pages (D27, D45, D69): five themes grouped under three contexts, and studies that are
 * still running, which are listed apart from the contexts under "Ongoing".
 */
export const themeSchema = z
  .object({
    title: z.string().min(1),
    /** One of the three contexts. A study that is still running has none. */
    context: z.enum(CONTEXTS).optional(),
    /** A study that is still running. */
    status: z.enum(['ongoing']).optional(),
    order: z.number().int(),
    /** One plain sentence for cards and the meta description. */
    summary: z.string().min(1).max(200),
    /** False where the page opens with its own summary, so the card sentence is not repeated. */
    lede: z.boolean().default(true),
    facts: factsRefs,
    /** Publication ids (see publications.yaml) to list at the end of the page. */
    publications: z.array(z.string()).default([]),
    builds: z.array(z.string()).default([]),
    /** Sketch scenes shown after the text (D73): the teacher scenes, on the teacher support page. */
    scenes: z.enum(['teachers']).optional(),
  })
  .refine((theme) => Boolean(theme.context) !== (theme.status === 'ongoing'), {
    error: 'A research page has one of the three contexts, or is ongoing: not both, not neither',
  });

export const PUBLICATION_TYPES = ['conference', 'extended-abstract', 'in-preparation'] as const;

/** Publications (facts.md §6). */
export const publicationSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    /** Item number in facts.md §6 (1–12); in-preparation items have none. */
    factsNumber: z.number().int().min(1).max(12).optional(),
    type: z.enum(PUBLICATION_TYPES),
    authors: z.array(z.string().min(1)).min(1),
    /** Required for published work; in-preparation manuscripts have no year yet. */
    year: z.number().int().min(2000).max(2100).optional(),
    title: z.string().min(1),
    venue: z.string().min(1),
    /** Venue acronym for the publication timeline, e.g. "ICALT". */
    venueShort: z.string().min(1).max(10).optional(),
    /** Publisher, pages and similar, as in facts.md. */
    details: z.string().optional(),
    /** Status notes from facts.md, e.g. "Full paper, accepted". */
    notes: z.array(z.string()).default([]),
    /** A recognition from facts.md §10, shown as a badge, e.g. "Best Paper Mention". */
    award: z.string().min(1).optional(),
    firstAuthor: z.boolean(),
    /** D28: one-sentence TL;DR; hidden while `draft` is true. */
    tldr: z.object({ text: z.string().min(1), draft: z.boolean() }).optional(),
    /** facts.md VERIFY: hidden from the site until Jimmy confirms. */
    verify: z.boolean().default(false),
    url: z.url().optional(),
    themes: z.array(z.string()).default([]),
  })
  .refine((pub) => pub.type === 'in-preparation' || pub.year !== undefined, {
    error: 'Published work needs a year',
  })
  .refine((pub) => pub.type === 'in-preparation' || pub.factsNumber !== undefined, {
    error: 'Published work needs its facts.md §6 item number',
  })
  .refine((pub) => pub.type === 'in-preparation' || pub.venueShort !== undefined, {
    error: 'Published work needs a venueShort for the timeline',
  });

/** What a build involved, for the matrix on /builds; each mark follows its datasheet. */
export const BUILD_AREAS = ['ai', 'sensing', 'spatial', 'hardware', 'web', 'study'] as const;
export const BUILD_AREA_LABELS: Record<(typeof BUILD_AREAS)[number], string> = {
  ai: 'AI and LLMs',
  sensing: 'Sensing and tracking',
  spatial: '3D, XR and robots',
  hardware: 'Hardware',
  web: 'Web and dashboards',
  study: 'User study',
};

/** Builds (facts.md §7), each with its own page. */
export const buildSchema = <T extends z.ZodType>(image: ImageValidator<T>) =>
  z.object({
    title: z.string().min(1),
    /** When, as facts.md gives it (e.g. "2018–21", "Sept 2021"); omitted where facts.md has a TODO. */
    when: z.string().min(1).optional(),
    /** Display order on /builds (editorial; follows the table in facts.md §7). */
    order: z.number().int(),
    summary: z.string().min(1).max(220),
    /** Datasheet lines, each traceable to facts.md §7. */
    datasheet: z.array(z.object({ label: z.string(), value: z.string() })).min(1),
    tags: z.array(z.string()).default([]),
    areas: z.array(z.enum(BUILD_AREAS)).default([]),
    video: z
      .object({
        id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
        title: z.string(),
        start: z.number().int().positive().optional(),
        /** Whose channel the video is on, when it isn't Jimmy's. */
        channel: z.string().optional(),
      })
      .optional(),
    images: z.array(z.object({ src: image(), alt: z.string().min(10) })).default([]),
    /** D29: optional "Hardest bug & fix", only from facts.md §7. */
    hardestBug: z.string().optional(),
    links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
    themes: z.array(z.string()).default([]),
    facts: factsRefs,
    /** Hidden until the missing facts arrive (TODO(jimmy) in the file). */
    draft: z.boolean().default(false),
  });

/** Talks (facts.md §11). Dated talks get time-aware wording (D26). */
export const talkSchema = z
  .object({
    id: z.string(),
    event: z.string().min(1),
    year: z.number().int(),
    kind: z.enum(['first-author-presentation', 'oral-presentation', 'paper-presentation']),
    title: z.string().optional(),
    location: z.string().optional(),
    startDate: isoDay.optional(),
    endDate: isoDay.optional(),
    timeZone: z.string().default('America/New_York'),
    /** D26 wording; required when the talk has dates. */
    wording: z
      .object({ upcoming: z.string(), ongoing: z.string().optional(), past: z.string() })
      .optional(),
    link: z.string().optional(),
  })
  .refine((talk) => !talk.startDate || talk.wording, {
    error: 'Dated talks need upcoming/past wording (D26)',
  })
  .refine((talk) => !talk.endDate || (talk.startDate && talk.endDate >= talk.startDate), {
    error: 'endDate must be on or after startDate',
  });

/** Dated news for "Recent" on the homepage. */
export const newsSchema = z
  .object({
    id: z.string(),
    /** As precise as facts.md allows. */
    date: partialDate,
    text: z.string().min(1).optional(),
    /** Time-aware item (D26): wording switches on the visitor's clock. */
    event: z
      .object({
        start: isoDay,
        end: isoDay.optional(),
        timeZone: z.string().default('America/New_York'),
        upcoming: z.string(),
        ongoing: z.string().optional(),
        past: z.string(),
      })
      .optional(),
    link: z.object({ href: z.string(), label: z.string() }).optional(),
    facts: factsRefs,
  })
  .refine((item) => Boolean(item.text) !== Boolean(item.event), {
    error: 'A news item has either fixed text or time-aware event wording, not both',
  });

/** Longest item of a daily note: a bold lead and a short paragraph, with room to spare. */
export const NOTE_LINE_MAX = 1000;
/**
 * Longest part of an item that the home page card shows: its bold lead, or else the whole item.
 * An item without a lead is a short sentence, and the card stays as short as the cards beside it.
 */
export const NOTE_CARD_MAX = 300;

/**
 * Daily notes (D71): one file per day, src/content/notes/<YYYY-MM-DD>.yaml, in Jimmy's words.
 * The file name is the date.
 */
export const noteSchema = z.object({
  /**
   * About three items, one per line, as he numbers them: a short sentence, or a bold lead
   * (**like this**) and a short paragraph, on what he did that day and what he learned.
   */
  lines: z
    .array(
      z
        .string()
        .min(1)
        .max(NOTE_LINE_MAX)
        .refine((line) => line === line.trim(), {
          error: 'No space at the start or end of a line',
        })
        .refine((line) => !/[\r\n\u2028\u2029]/.test(line), {
          error: 'One item per line, without line breaks inside it',
        })
        .refine((line) => !hasLoneBoldMarker(line), {
          error:
            'Bold comes in pairs, **like this**: a ** that does not pair up would show as asterisks',
        })
        .refine((line) => (noteLead(line) ?? noteText(line)).length <= NOTE_CARD_MAX, {
          error: `An item without a bold lead, and a lead, are at most ${NOTE_CARD_MAX} characters: the home card shows them`,
        })
        .refine((line) => !/\p{Cc}/u.test(line), {
          // "\t" in double quotes becomes a tab: such a line belongs in single quotes.
          error: 'No tabs or other control characters (a backslash escape inside double quotes?)',
        }),
    )
    .min(1)
    .max(5),
});

/** Blog posts (D41): Jimmy's Zhihu answers in Chinese, with English title and summary. */
export const blogSchema = z.object({
  title: z.string().min(1),
  title_en: z.string().min(1),
  summary_en: z.string().min(40).max(600),
  date: z.coerce.date(),
  lang: z.enum(['zh-CN']).default('zh-CN'),
  zhihu_url: z.url().refine((url) => /^https:\/\/(?:www\.|zhuanlan\.)?zhihu\.com\//.test(url), {
    error: 'zhihu_url must point to zhihu.com',
  }),
  tags: z.array(z.string()).min(1).max(5),
  draft: z.boolean().default(false),
});

/** Homepage word-cloud groups, named after the planned portals (SITE_PLAN §4). */
export const WORD_GROUPS = ['ask', 'hands', 'life'] as const;
export const WORD_GROUP_LABELS: Record<(typeof WORD_GROUPS)[number], string> = {
  ask: 'Research',
  hands: 'Building and sensing',
  life: 'Teaching and life',
};

/** Homepage word cloud (content/wordcloud.yaml). */
export const wordSchema = z.object({
  text: z.string().min(1).max(40),
  weight: z.number().int().min(1).max(5),
  portal: z.enum(WORD_GROUPS),
  /** A page on this site. */
  link: z.string().regex(/^\/(?:[a-z0-9-]+\/)*$/, { error: 'Use a site path like /research/' }),
  /** At most 15 words; true per facts.md. */
  blurb: z
    .string()
    .min(1)
    .refine((text) => text.split(/\s+/).length <= 15, { error: 'Keep blurbs to 15 words' })
    .optional(),
});
