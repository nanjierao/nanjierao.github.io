# nanjierao.github.io

Source for **https://nanjierao.github.io**, the personal website of Nanjie (Jimmy) Rao, HCI
researcher. Built with Astro, published by GitHub Actions to GitHub Pages, and maintained by
Jimmy with Claude Code cloud sessions. This repository is public.

**Start here:** `docs/SESSION_PROMPTS.md` → "Setup in the browser", then S1. Blog posts:
`/post-zhihu` in a Claude Code session.

- `CLAUDE.md` — standing instructions for Claude Code (stack, content/image/AI rules, open-source-first, pull-request workflow)
- `docs/SITE_PLAN.md` — the plan (v5): intro strip + word cloud + three portals + blog + easter egg, architecture, timeline, Jimmy-only tasks
- `docs/SESSION_PROMPTS.md` — browser setup, then copy-paste prompts for sessions S1–S10, in order
- `docs/DECISIONS.md` — decision log (what was decided, why, status)
- `docs/THIRD_PARTY.md` — vetted open-source projects to adapt, with licenses
- `content/facts.md` — single source of truth for facts and numbers
- `content/wordcloud.yaml` · `qa-library.yaml` · `hand-stories.yaml` · `reflections.yaml` · `ideas.yaml` · `life-portal.md` — content drafts for the homepage and portals
- `source/` — public-safe research materials: dissertation abstract, extraction prompt (App. C), coding-scheme definitions (App. A, no participant quotations), old site (images of other people and study materials removed, see DECISIONS D53), CS-UDT notes
- `public/demos/csudt/` — CS-UDT flood digital twin demo (self-contained HTML, synthetic data)
- `migration/cise/` — redirect files + HOWTO for the old cise.ufl.edu/~nr0 page (`.htaccess` is a hidden file)
- `.claude/skills/post-zhihu/` — the `/post-zhihu` command that turns a Zhihu draft into a blog post
- `inbox/` — where Jimmy uploads files meant for the site (drafts, images, CV PDF); sessions move them

The Astro site itself (S1 onward):

- `src/` — pages, components, styles (`src/styles/tokens.css`), content collections (`src/content/`), site constants (`src/data/`), and images (`src/assets/`)
- `scripts/` — `fetch-external.ts` (GitHub activity and the latest video, at build time) and `check-privacy.ts`
- `tests/` — Vitest unit and content checks, Playwright + axe end-to-end tests, synthetic fixtures
- `.github/workflows/deploy.yml` — checks, build and deploy to GitHub Pages

Workflow: Claude Code cloud session → pull request with screenshots → Jimmy merges → GitHub Actions → GitHub Pages.
