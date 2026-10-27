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
- `source/` — public-safe research materials: dissertation abstract, extraction prompt (App. C), coding-scheme definitions (App. A, no participant quotations), old site, CS-UDT notes
- `public/demos/csudt/` — CS-UDT flood digital twin demo (self-contained HTML, synthetic data)
- `migration/cise/` — redirect files + HOWTO for the old cise.ufl.edu/~nr0 page (`.htaccess` is a hidden file)
- `setup/post-zhihu/` — the `/post-zhihu` command that turns a Zhihu draft into a blog post; S1 moves it to `.claude/skills/post-zhihu/`
- `inbox/` — where Jimmy uploads files meant for the site (drafts, images, CV PDF); sessions move them

Workflow: Claude Code cloud session → pull request with screenshots → Jimmy merges → GitHub Actions → GitHub Pages.
