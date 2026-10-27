// Content schemas, shared by src/content.config.ts and the Vitest content checks.
// Image fields take a validator so tests can substitute a plain string check for Astro's
// `image()` helper, which only exists inside the collection config.
import { z } from 'astro/zod';

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

/** Research themes (D27, D45): five pages grouped under three contexts. */
export const themeSchema = z.object({
  title: z.string().min(1),
  context: z.enum(CONTEXTS),
  order: z.number().int(),
  /** One plain sentence for cards and the meta description. */
  summary: z.string().min(1).max(200),
  facts: factsRefs,
  /** Publication ids (see publications.yaml) to list at the end of the page. */
  publications: z.array(z.string()).default([]),
  builds: z.array(z.string()).default([]),
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
    /** Publisher, pages and similar, as in facts.md. */
    details: z.string().optional(),
    /** Status notes from facts.md, e.g. "Full paper, accepted" or an award. */
    notes: z.array(z.string()).default([]),
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
  });

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
