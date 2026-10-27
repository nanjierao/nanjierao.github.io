# Session prompts for Claude Code cloud sessions (v5)

How to run one: claude.ai/code (or the Code tab in the Claude app) → repository
`nanjierao/nanjierao.github.io` → paste the prompt → let it work → open the pull request it
creates and look at the screenshots → reply in the session with fixes → merge on GitHub (web or
phone). Merging publishes https://nanjierao.github.io within a minute or two. Start a fresh session
for each numbered task.

v5: cloud sessions, GitHub Pages, blog, YouTube and Zhihu links, optional Worker (DECISIONS
D37–D52). Paste these prompts as they are. Don't paste review text or "master prompts" from other
assistants: they carry facts that aren't in `content/facts.md`.

Order: **setup in the browser → S1 → S2 then S3, alongside S4 → S5, S6, S7 → S8 (optional) →
S9**, and S10 in January. Blog posts any time after S1, with `/post-zhihu`.

Files: paste text drafts straight into the session. Files that belong on the site (images, the CV
PDF, photos) go into the repository's `inbox/` folder first (GitHub web or mobile: Add file →
Upload files); the session moves them.

Every prompt assumes the session reads CLAUDE.md first, including **Open source first**: search,
compare, adapt, credit — don't rebuild what already exists.

Checklist for every pull request:
- [ ] Screenshots look right on phone and desktop, light and dark
- [ ] Facts match content/facts.md; nothing in the facts.md §15 categories
- [ ] New third-party code is in docs/THIRD_PARTY.md with its license
- [ ] TODO(jimmy) list answered or carried forward
- [ ] Checks passed (build, check, lint, test, check:privacy)

---

## Setup in the browser (Jimmy, about 10 minutes, once)

1. github.com → your avatar → Your organizations → New organization → Free plan → name `nanjierao`.
2. In the organization, create a **public** repository named exactly `nanjierao.github.io`
   (no README, no license).
3. On the empty repository's page, choose "uploading an existing file" and drag in everything
   inside `~/Downloads/JobR/nanjierao-site` (not the folder itself). Press Cmd+Shift+. in Finder
   first if you want the hidden `.gitignore` to come along; S1 recreates it if it's missing.
   Commit.
4. Repository → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
5. claude.ai/code → connect GitHub → install the Claude GitHub App for the `nanjierao`
   organization (only this repository) → start a session on it and paste S1.

## S1 — Housekeeping, scaffold, classic pages, blog skeleton, v0 live

```
Read CLAUDE.md, docs/SITE_PLAN.md, docs/DECISIONS.md, docs/THIRD_PARTY.md and content/facts.md.
Goal: v0 at https://nanjierao.github.io with the neutral baseline design and real content.
New branch, then a pull request.
0. Housekeeping: move setup/post-zhihu/ to .claude/skills/post-zhihu/ and remove setup/; delete
   any .DS_Store files; make sure .gitignore exists (content as described in CLAUDE.md: node_modules,
   dist, .astro, .wrangler, .dev.vars, .env*, .DS_Store, test output).
1. Scaffold Astro + TypeScript (strict, static output) at the repository root without deleting
   existing files (CLAUDE.md, docs/, content/, source/, public/demos/, migration/, inbox/,
   .claude/). Add @astrojs/react, @astrojs/sitemap, @astrojs/rss, Prettier, ESLint, Vitest,
   Playwright + @axe-core/playwright, the npm scripts in CLAUDE.md, and `npm run check:privacy`
   (repository + build output: phone numbers, unexpected email addresses, street addresses,
   facts.md §15 terms, image GPS/EXIF).
2. Deploy: the official Astro → GitHub Pages workflow (withastro/action + actions/deploy-pages;
   current versions from the Astro docs), on push to main, workflow_dispatch, and a weekly
   schedule that only rebuilds; check, lint, test and check:privacy run before the build. site
   'https://nanjierao.github.io', no base. No step that commits to main.
3. Content collections: research themes grouped Personal · Embodied · Civic (D45); builds
   (optional hardestBug, D29); talks (dates for time-aware wording, D26); publications (12 items
   from facts.md §6; tldr from the §6 drafts, hidden while marked DRAFT; in-preparation items
   behind a flag that is off); blog (title, title_en, summary_en, date, lang, zhihu_url, tags,
   draft; images beside each post). Vitest content checks.
4. Pages with real content only: Home (temporary until S3: the intro strip from D21 with
   positioning option 4 from facts.md §3 as a placeholder, no status line until §2 has an approved
   one, and the Elsewhere links: Scholar, GitHub, YouTube, Zhihu; research themes; "Recent" with
   dated news, the latest blog post, the latest YouTube video and GitHub activity), Research
   overview + 5 theme pages, Publications, Builds (cards + one page each + "On GitHub"), Teaching,
   CV (HTML; "Download CV (PDF)" only when public/cv/Nanjie_Rao_CV.pdf exists, otherwise a TODO),
   About (with "Elsewhere"), Blog index + post layout (English title and summary on top, Chinese
   body with lang="zh-CN", link to the Zhihu original) + RSS, Privacy (placeholder), Credits
   (dependencies + a "How this site was built" stub, D35), 404. Placeholder pages for /hands,
   /ask, /life that say "coming soon".
5. GitHub activity and latest video (D40, D50): fetch JimmyRaoUF's public activity and
   repositories (plus public repositories of the nanjierao organization) and the YouTube channel's
   RSS feed during the Actions build as static content, never committed; refresh GitHub activity
   in the browser from the public API with a sessionStorage cache; fail quietly. This session's
   network may block those sites: use fixtures in tests and say what you couldn't reach.
6. /demos/csudt: simple page linking the two demo files in public/demos/csudt/ (don't modify them).
7. Images from source/old-site/img go into src/assets and through Astro's image pipeline (D31)
   with real alt text. YouTube as click-to-load facades (youtube-nocookie).
8. A small time-aware helper (D26): build-time tense plus a tiny client-side update; unit-test it
   with dates before and after 2026-11-20.
9. SEO basics (canonical https://nanjierao.github.io), JSON-LD Person (sameAs Google Scholar,
   https://github.com/JimmyRaoUF, the YouTube channel and the Zhihu profile), sitemap,
   robots.txt. Leave migration/cise/ alone.
10. Light/dark tokens, theme toggle, skip link, visible focus, the footer annotation legend (D30).
PR: summary, screenshots (phone/desktop, light/dark), what the checks found, and every
TODO(jimmy)/VERIFY item. Remind me that Pages must be set to GitHub Actions before I merge.
```

## S2 — Design spike: homepage concepts (after S1)

```
Read CLAUDE.md, docs/SITE_PLAN.md §4 and §8, docs/DECISIONS.md (D21, D30), docs/THIRD_PARTY.md,
content/wordcloud.yaml.
Build two (at most three) homepage variants on /lab/a, /lab/b (and /lab/c). Each has, in this
order: the intro strip (D21), the word cloud, the three portal cards (Hands, Ask, Life & You —
placeholders behind them), "Recent", the footer legend, and the bottom-right luopan glyph (the
panel can be a stub).
- Word cloud: start from d3-cloud + motion (recommended). In one variant, try an alternative from
  THIRD_PARTY.md (wordcloud2.js or matter-js floating words). Portal ↔ word linking (hover/focus a
  portal → its words glow and drift toward it; click a word → blurb + link), an HTML-list fallback,
  and a reduced-motion static state.
- On a 390 × 844 phone, the first screen shows the name, the one line, CV / Publications / Email,
  and the top of the cloud.
- Each variant has its own token set (type scale, light/dark colors, spacing). Report WCAG
  contrast ratios. Measure homepage JS (gzipped) and Lighthouse mobile for each variant.
PR: side-by-side screenshots (phone/desktop, light/dark), a metrics table, a short pros/cons note
per variant, and the dependencies each uses with licenses. Don't touch other pages.
```
Then reply with your choice. Ask the session to write docs/DESIGN.md, delete /lab, and update the
PR; then merge.

## S3 — Homepage for real + easter egg + classic polish (after S2)

```
Read CLAUDE.md, docs/DESIGN.md, docs/SITE_PLAN.md §4 and §7, content/wordcloud.yaml,
content/ideas.yaml. Build the homepage from the chosen design: intro strip, word cloud, portals
(pointing to coming-soon pages until the portals exist), "Recent" with time-aware wording (D26),
and the easter egg (luopan glyph → side panel with the three bilingual idea cards;
keyboard-reachable last in tab order; accessible name "Things I want to try next"; hint 未完待续 /
to be continued). Luopan teaser: a cursor-following needle on desktop that settles with a slight
damped spring; on phones, after a tap, DeviceOrientation points it north (iOS permission flow);
static under reduced motion. Apply the design system across all classic pages and the blog
(sidenotes, datasheet cards for builds with the optional "Hardest bug & fix", publication filters
that work without JS, TL;DR lines, print stylesheet for /cv, OG image template). Lighthouse table
for /, /research, /publications, /builds, /blog in the PR. End the PR with a reminder for me to
run migration/cise/HOWTO.md once this is live.
```

## S4 — CS-UDT demo + DTRUE talk page (after S1; alongside S2/S3; due Nov 12)

```
Read CLAUDE.md, docs/SITE_PLAN.md, content/facts.md §5.3, source/csudt/README.md.
1. /demos/csudt explainer in the site design (three channels, convergence rule, quests, what's
   simulated, Irma replay numbers), with launch buttons for the planner dashboard and the citizen
   client (best on a phone). It must open fast on bad conference Wi-Fi: the explainer is static
   with one light preview image (a screenshot of the demo; tell me if you can't capture one), and
   the live demo loads only when someone taps Launch. Disclose that the demo loads MapLibre and
   qrcode.js from public CDNs; keep OSM attribution.
2. /talks/dtrue-2026: title, authors exactly as facts.md §6 item 10 (if still marked VERIFY, ask
   me), venue and date (UF Jacksonville campus, Nov 19–20, 2026), abstract from facts.md, demo
   link, slides placeholder, citation. Time-aware wording (D26): "Upcoming oral presentation"
   through Nov 20, then "Presented at DTRUE 2026".
3. QR code SVG for https://nanjierao.github.io/demos/csudt/ (with the trailing slash; high
   contrast, quiet zone, error correction M or higher) at public/talks/dtrue-2026/qr-csudt.svg,
   plus a PNG for slides. Use an existing QR library; note which.
4. Playwright check of both demo files at 390 px width; list problems without editing the files.
PR: also list what I should keep offline on my laptop for the talk in case the venue Wi-Fi fails.
```

## S5 — Middle portal: Ask (static)

```
Read CLAUDE.md (AI section), docs/SITE_PLAN.md §5.2, content/qa-library.yaml.
1. Q&A library UI: suggested questions grouped by audience; click shows the stored answer with
   source links instantly. Only items with status: ready.
2. Search: MiniSearch over questions and answers (fuzzy + prefix), in the browser; show the three
   closest answers; if nothing is close, say it isn't covered on this site and show the email
   link. Nothing typed leaves the browser.
3. Live slot: if PUBLIC_API_URL is set at build time, show "Ask anything" and "Fit check" tabs
   (built in S8); otherwise don't render them.
4. Tests: 20 sample questions mapped to the library items they should find; keyboard and
   screen-reader pass; axe.
```

## S6 — Left portal: Hands

```
Read CLAUDE.md (camera rules), docs/SITE_PLAN.md §5.1, docs/DECISIONS.md (D05–D07, D23),
content/hand-stories.yaml, docs/THIRD_PARTY.md. Don't write a hand tracker or 3D engine: start from
collidingScopes/threejs-handtracking-101 (MIT) — vendor it into src/vendor/ with its LICENSE and a
NOTES.md of changes — and @mediapipe/tasks-vision HandLandmarker with WASM and model self-hosted in
public/mediapipe/ (if the model download is blocked here, tell me and I'll upload the file to
inbox/).
Build /hands:
1. Scripted first (D23): the page opens playing story 1, with Pip moving to recorded motion
   (public/hands/recordings/<story>.json; keyframed placeholder until recordings exist) and
   captions on. A prominent "Use my hand (camera)" button.
2. Camera mode: request the camera only on that click; on-device only; indicator + stop;
   automatic fallback to scripted mode on denial, error, or < ~15 fps. Load MediaPipe and the model
   on intent (hover/focus/tap of the button) or as an idle prefetch on desktop with a fast
   connection and Save-Data off; never on page load for phones. Phone note: best on a laptop, or
   with the phone propped up.
3. Puppet "Pip" (original, simple geometry or a CC0 model): thumb–index distance → jaw; wrist →
   head position/roll; mouth open-and-close → next caption line; open palm held 1 s → next story.
   Smooth landmarks (One Euro filter or similar — use an existing implementation if available).
4. /hands/record (noindex, unlinked): records landmarks at 30 fps for a chosen story and downloads
   JSON in the playback format (I upload the recordings to inbox/ later).
5. Captions always; optional speech synthesis toggle (off by default); keyboard: Space, →, Esc.
6. "How it works" footer + links to the puppet system and Hands as Narrators.
Lazy-load everything; nothing heavy on other routes. Test both modes on a phone-sized viewport, and
report how many bytes a phone visitor who only watches downloads.
```

## S7 — Right portal: Life & You (sample people + your own AI)

```
Read CLAUDE.md (AI section; camera and visitor data; images), docs/SITE_PLAN.md §5.3,
docs/DECISIONS.md (D10, D11, D24, D42), content/life-portal.md, content/reflections.yaml,
source/study2-extraction-prompt.md, source/coding-scheme-definitions.md.
Build /life exactly as content/life-portal.md specifies, with the Sample and Your-own-AI modes:
1. Reflections (status: ready only), random; photo reflections rendered with
   collidingScopes/particular-drift (MIT; vendor with LICENSE + NOTES.md; lazy-load WebGL2; static
   image fallback). Photos follow D31.
2. Three sample people (primary button): write the synthetic personas and their pre-computed JSON
   by hand; the whole flow, including the lesson, works with no network. Label them synthetic.
3. Your own AI: consent card + 18+ notice → the asking question → the copyable prompt from
   life-portal.md → a box for the JSON answer, validated against the schema with friendly errors
   → an optional local box for the visitor's records, used only in the browser to check whether
   each grounded quote appears in them → results → the copyable lesson prompt.
4. Results UI with the grounded/inferred convention; confirm/reject; computed Accuracy, Depth,
   Richness, Phase, and "what asking missed", next to the study numbers from facts.md §5.1–5.2 with
   the caveat line and the self-curation note.
5. A Live-mode slot that appears only when PUBLIC_API_URL is set (built in S8).
Tests: the sample people; malformed and oversized JSON; prompt-injection strings inside pasted
JSON rendered as text, never as HTML.
```

## S8 — Live AI through a Cloudflare Worker (optional)

Before: create a free Cloudflare account; claim the API credits; create a Console workspace with a
$180 monthly limit and auto-reload off; create an API key; create a Turnstile widget for
nanjierao.github.io and localhost. You add `ANTHROPIC_API_KEY` and `TURNSTILE_SECRET_KEY` as Worker
secrets yourself in the Cloudflare dashboard. Never paste the key into a session or chat.

```
Read CLAUDE.md (AI section), docs/SITE_PLAN.md §5.2, §5.3, §9 and §10, docs/DECISIONS.md (D09,
D22, D25, D32, D43, D44), content/life-portal.md (prompt specs), content/qa-library.yaml.
1. worker/: a Cloudflare Worker in TypeScript with wrangler and the official @anthropic-ai/sdk:
   POST /ask, /fit, /interests, /lesson. CORS allowlist exactly https://nanjierao.github.io and
   http://localhost:4321 with OPTIONS preflight; Turnstile verification; per-IP limits and global
   daily caps; input limits; max_tokens; model from ANTHROPIC_MODEL (default claude-haiku-5-5;
   confirm model IDs, citations and prompt caching in the current Anthropic docs). The knowledge
   pack comes from https://nanjierao.github.io/ask/knowledge.json (build it in the site), cached.
   STUB mode when no key. No logging of visitor text.
2. Deployment: set it up with Cloudflare's Git integration on the worker/ folder and tell me the
   exact clicks, then the workers.dev URL to set as the GitHub Actions variable PUBLIC_API_URL,
   plus PUBLIC_TURNSTILE_SITE_KEY.
3. Site: with PUBLIC_API_URL set, enable the live tabs on /ask (chat with citation chips; Fit check
   with Direct evidence · Transferable foundation · Let's discuss) and the Live mode on /life. On
   any failure, fall back to the static modes with a calm note.
4. tests/assistant-evals.yaml (30 cases from SITE_PLAN §5.2) + a script that runs them against the
   Worker in STUB and live modes. Update /privacy with Anthropic's API data terms from Anthropic's
   current official pages (link them).
```

## S9 — Audit, credits, polish (late November)

```
Audit against CLAUDE.md: content truth (claim → facts.md line table); the whole public repository
and its history for files that shouldn't be public; check:privacy over the build output (HTML,
JSON, the knowledge pack, metadata, PDF text, image GPS/EXIF); axe on every page; Lighthouse mobile
per page type; broken links; JSON-LD and OG; keyboard walkthrough of the homepage cloud, all three
portals, the blog, and the easter egg; camera-denied, GitHub-API-down, YouTube-feed-down and
Worker-down paths; time-aware copy with the clock set after 2026-11-20 and after 2027-01-01; if S8
happened, rerun the evals and test CORS from another origin. Finish /credits ("How this site was
built" + every dependency and vendored project with license and link). Check that
migration/cise/ targets still exist. Fix what you can and list the rest in the PR.
```

## S10 — Chinese pages + easter-egg upgrades (Jan 2027)

```
Add /zh versions of the homepage strip, Research overview, About, Builds, and the easter-egg
notebook (already bilingual) with Astro i18n routing and a language switch; link the blog. Use the
Chinese name in facts.md §1. Translate meaning, keep field terms in English where Chinese readers
use them. Don't publish /zh routes until I approve each page. Then propose (don't build) small
interactive teasers for each idea card.
```

## Blog posts (any time after S1)

Paste the draft into a new session, or upload the draft and its images to `inbox/`, then run
`/post-zhihu <zhihu answer URL>`. The session drafts the English title and summary, places the
images, runs the privacy check, and opens a pull request; merging publishes the post.
