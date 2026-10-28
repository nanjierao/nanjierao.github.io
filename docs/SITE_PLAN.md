# Site plan — nanjierao.github.io (v5)

Owner: Nanjie (Jimmy) Rao · v5 drafted 27 Oct 2026 (afternoon): back to Claude Code cloud
sessions, YouTube and Zhihu links (D49–D52). v4 the same morning: GitHub Pages instead of a custom
domain, a blog, and optional live AI through one Worker (D37–D48). v3 (24 Oct) folded in an
outside review; v1 and v2 the same day. Decisions and their status:
`docs/DECISIONS.md`. Open-source picks: `docs/THIRD_PARTY.md`.

## 0. In one paragraph

Replace the 2019-era page at cise.ufl.edu/~nr0 with a site that *shows* what Jimmy does and keeps
running with almost no upkeep. It lives at https://nanjierao.github.io, built by GitHub Actions
from a public repository that Jimmy maintains with Claude Code cloud sessions. The homepage opens with
a compact intro strip (name, one line, CV, publications, email) for anyone who needs the facts in
five seconds. Below it are a living word cloud of his research background and three doors.
**Hands** (left, most technical) starts telling a story with Jimmy's recorded hand motion, and the
visitor's own hand can take over through the camera, all in the browser. **Ask** (middle) answers
questions about his work from a reviewed Q&A library, searchable in the browser. **Life & You**
(right) moves from his reflections to a run of his dissertation's method, on a sample person or
through the visitor's own AI assistant. A blog carries his Zhihu answers with English summaries,
and links lead to his YouTube channel and Zhihu profile. A
hidden luopan in the bottom-right corner opens a notebook of ideas he wants to try next. All of
this works without a server; an optional Cloudflare Worker can later add a live assistant and live
analysis. The site adapts good open-source work instead of reinventing it.

## 1. Audiences

| Audience | Needs in 30 seconds | Path |
|---|---|---|
| Faculty search committees | Agenda, first-author work, venues, teaching | Intro strip → CV, Publications · Research · Ask |
| Industry (UX research, AI/ML product, XR, ed-tech) | What he builds, with what, evaluated how | Intro strip → CV · Builds · Hands · Ask |
| Collaborators, students | Topics, papers, ideas | Research · Ask · Blog · easter-egg ideas |
| DTRUE 2026 audience (Nov 19–20) | The flood demo on their phone | QR → /demos/csudt/ |
| Curious visitors | Something delightful and true | Hands · Life & You |
| Chinese-speaking readers | His writing in Chinese | Blog now; /zh pages later |

## 2. Positioning

Headline options: `content/facts.md` §3 (Jimmy picks; option 4 matches the final dissertation).
Research overview: one umbrella line (Jimmy picks; default from his research statement) over three
contexts: **Personal · Embodied · Civic** (D27, D45). Proof points, each linked to evidence: ICALT
2026 and ICIDS 2026 first-author full papers; the DTRUE 2026 framework and working prototype (with
Jatin Verma; author list VERIFY); the grounded-vs-inferred check (505 of 1,130 units inferred);
builds across software and hardware (NSF puppet system, AR glasses, XPRIZE semifinal robot);
teaching (COP 3530 discussion sections for ~150 students in total; co-taught graduate HCI).

## 3. Information architecture

```
/                      Intro strip + word cloud + three portals + recent + easter egg
/hands                 Left portal: hand-puppet storytelling (scripted first; camera on request)
/hands/record          Hidden: Jimmy records hand motion for scripted stories (noindex)
/ask                   Middle portal: Q&A library + in-browser search (+ live chat and Fit check, S8)
/life                  Right portal: reflections → sample person or your own AI (+ live, S8) → lesson
/research              Overview (Personal · Embodied · Civic) + theme pages: interest-identification ·
                       grounding · civic-digital-twins · embodied-learning · teacher-support
/publications          Filterable list, TL;DRs, links, BibTeX
/builds, /builds/[slug] Datasheet cards + "On GitHub" (JimmyRaoUF's public repositories)
/blog, /blog/[slug]    Zhihu answers in Chinese, each with an English title and summary; RSS
/demos/csudt           CS-UDT flood digital twin (existing demo files)
/talks/dtrue-2026      Talk page + QR target
/teaching · /cv (HTML + PDF) · /about · /privacy · /credits · /404
/zh/...                Later (S10)
```

## 4. Homepage

Top to bottom (D21):
- **Intro strip**: name (optional pronunciation button, D36), one-line positioning (facts.md §3),
  status line (facts.md §2, only once Jimmy approves one), and three actions: CV (PDF),
  Publications, Email. Small "Elsewhere" links: Google Scholar, GitHub (JimmyRaoUF), YouTube,
  Zhihu, and whichever of ORCID and LinkedIn facts.md §13 lists. On a phone it fits in the first screen with the top of the cloud
  visible below it.
- **Word cloud** (`content/wordcloud.yaml`): ~40 terms weighted by prominence and tagged by portal
  (hands / ask / life). Layout `d3-cloud`, gentle drift with `motion`. Hovering or focusing a
  portal makes its words glow and drift toward it. Clicking a word opens a one-line blurb with a
  link. Under reduced motion it is static; it is also rendered as an HTML list for screen readers.
  On a phone it stays three centered lists of all the words, so each keeps a 24 px target (D60).
- **Three portals** under or around the cloud: Hands (camera glyph), Ask (speech glyph),
  Life & You (spark glyph). Each has one line of copy and a clear action. Desktop: left, middle,
  right. Mobile: stacked in the same order.
- **Recent**: three dated news items with time-aware wording (D26), the latest blog post, the
  latest YouTube video (D50), and recent public GitHub activity (D40).
- **Easter egg**: a small luopan glyph fixed at the bottom-right, low contrast until hovered or
  focused, hint "未完待续 / to be continued". It opens a side panel, "Things I want to try / 想尝试的事",
  with three bilingual idea cards (`content/ideas.yaml`): feng shui × HCI × AI (inspired by
  刘克明's 中国技术思想研究, 2004), children and AI, and a personal decision digital twin. On phones,
  after a tap, the needle can turn to north using the device compass; on desktop it follows the
  cursor and settles with a slight damped spring. Static under reduced motion.
- **Footer**: the annotation legend (D30), links, credits.
- Budget: homepage JS ≤ 60 KB gzipped; portals and the easter-egg teaser load on demand.

## 5. Portals

### 5.1 Left — Hands (`/hands`), the technical one
- Start from **collidingScopes/threejs-handtracking-101** (MIT) and **MediaPipe HandLandmarker**
  (Apache-2.0, WASM and model self-hosted in `public/mediapipe/`).
- Puppet "Pip": the visitor's hand is the mouth. Thumb–index distance opens the jaw; wrist position
  and roll move the head; each mouth "open-and-close" advances a caption line; an open palm held
  for 1 s goes to the next story. Original character, built in three.js from simple geometry or a
  CC0 model.
- Stories: `content/hand-stories.yaml` (three short scripts tied to XPRIZE, Study 1, CS-UDT), each
  with an "about this story" link.
- Entry (D23): the page opens playing story 1 in **scripted mode**: recorded landmark JSON
  (`public/hands/recordings/*.json`) drives Pip, captions on. Jimmy records these with
  `/hands/record`; until then, keyframed motion.
- A prominent **"Use my hand (camera)"** button switches to camera mode: camera requested only on
  that click, processed on-device, with an indicator and stop button; automatic fallback on
  denial, error, or under ~15 fps. MediaPipe loads on intent, never on page load for phones. On
  phones, a note: best on a laptop, or with the phone propped up.
- Keyboard: Space = next line, → = next story, Esc = stop. Captions always on; speech synthesis
  toggle off by default. Footer: how it works, with links to the puppet system (HCII 2021) and
  Hands as Narrators (ICIDS 2026).

### 5.2 Middle — Ask (`/ask`)
- **Static (always)**: the Q&A library (`content/qa-library.yaml`, `status: ready` only), grouped by
  audience; click → the stored answer with source links. A search box runs **MiniSearch** over
  questions and answers in the browser and shows the three closest answers; if nothing is close,
  "not covered on this site" and the email link. Nothing typed leaves the browser.
- **Live (S8, optional)**: when `PUBLIC_API_URL` is set, an "Ask anything" tab sends free text to
  the Worker: Claude with the library and the site's knowledge pack, citations to site pages, third
  person, "not in Jimmy's public materials" when unknown, declines for facts.md §15 topics. A
  **Fit check** tab maps a pasted job description to evidence on this site with statuses Direct
  evidence · Transferable foundation (cites a page; marked inferred) · Let's discuss (email).
  Loading text says what is happening (D32). Any failure → back to the static tab.
- Live-mode evals before switching it on: 30 cases (facts with correct citations; declines for
  personal topics, prompt injection, off-topic; Fit check never invents a skill). Pass: 100% on
  declines, ≥ 90% factual with valid citations.

### 5.3 Right — Life & You (`/life`)
Full spec and copy: `content/life-portal.md`. Five acts:
1. Reflections from `content/reflections.yaml` (only `ready`), random; photos rendered with
   **collidingScopes/particular-drift** (MIT) particles; photo rules in D31.
2. Three ways in (D24, D42): **"Try it with a sample person"** (primary; three synthetic people,
   pre-computed) · **"Use your own AI"** (copy a prompt into ChatGPT, Claude, Gemini…, paste its
   JSON answer back; no API, nothing leaves the browser) · **Live** (S8, only when the Worker is on).
3. Results: interests with units labeled category, grounded/inferred, and phase guess; the visitor
   confirms or rejects each. If the visitor also pastes their records into a local box, the page
   checks in the browser whether each "grounded" quote really appears in them.
4. The visitor's Accuracy, Depth, Richness, and Phase, plus what asking missed, next to Jimmy's
   study numbers, with the caveat and the dissertation's self-curation limitation.
5. A lesson through one confirmed interest (hash tables, binary search, or how a flood twin
   confirms an event): pre-written for sample people, a copyable lesson prompt in "your own AI"
   mode, generated in live mode.

## 6. Blog (D41)

- Source: Jimmy's Zhihu answers, written locally first. He pastes the draft into a cloud session
  (or uploads it with its images to `inbox/` through GitHub web or mobile) and runs `/post-zhihu
  <zhihu-url>` (`.claude/skills/post-zhihu/`, D52). The session places the post and its images in
  `src/content/blog/<slug>/`, drafts `title_en` and a 2–3 sentence `summary_en`, runs the privacy
  check, and opens a pull request with screenshots; merging publishes.
- Post page: English title and summary at the top, then the Chinese body (`lang="zh-CN"`), the date,
  tags, and a link to the original on Zhihu. Index: English titles and summaries, so readers who
  don't read Chinese can still see what he thinks about. RSS feed. No comment system; discussion
  stays on Zhihu.

## 7. Classic pages

- **Research**: overview with the umbrella line and the three contexts (D27, D45), then theme
  pages adapted from facts.md and `source/dissertation-abstract.md`; no job-specific framing.
- **Publications**: from facts.md §6, a TL;DR under first-author papers once approved (D28),
  filters that work without JS, BibTeX copy; Working papers only if approved.
- **Builds**: datasheet cards with an optional "Hardest bug & fix" (D29), plus "On GitHub".
- **Teaching**.
- **CV**: rendered from the same content, plus a downloadable PDF that Jimmy supplies (no phone, no
  home or street address). Statement PDFs later, only if he provides general versions.
- **About**: short/long bio with copy buttons, headshot, talks.
- **Privacy** and **Credits** (every dependency, plus "How this site was built", D35).

## 8. Design

- Process: S2 builds two (at most three) homepage variants (intro strip + cloud + portals) on
  `/lab/*` routes; Jimmy picks; the choice is written to `docs/DESIGN.md`.
- Recommended direction, "Grounded": calm editorial base. Evidence is visible: sidenotes on wide
  screens, and a grounded/inferred annotation convention (solid vs. dotted underline + label +
  color) shared by the Ask answers and the Life results and explained in the footer legend (D30).
  Builds use "Lab Bench" datasheet cards. Portals can each have their own mood (Hands playful, Ask
  calm, Life warm) within one token system.
- Type: a readable serif for headings (Newsreader or Source Serif 4), a humanist sans for UI and
  body (Inter or IBM Plex Sans), a mono for data (IBM Plex Mono), all self-hosted; system CJK fonts
  for Chinese text.
- Accessibility WCAG 2.2 AA; light/dark; reduced motion; every interactive has a keyboard path and
  a no-JS or no-camera fallback.

## 9. Architecture

```
Claude Code cloud session (claude.ai/code) ── pull request + screenshots ──▶ Jimmy merges ──▶
GitHub: nanjierao/nanjierao.github.io (public) ── Actions: build on merge, by hand, and weekly
    (+ fetch GitHub activity and the YouTube RSS feed) ──▶
GitHub Pages: https://nanjierao.github.io (static files only)

Visitor's browser ──▶ api.github.com (public activity, cached)
Visitor's browser ──(only if PUBLIC_API_URL is set)──▶ Cloudflare Worker (workers.dev):
    /ask · /fit · /interests · /lesson  ──▶ Anthropic Messages API (key = Worker secret)
```
- No server in the site, no secrets in the repository, and no workflow ever commits to `main`.
  The weekly rebuild only refreshes "Recent"; if GitHub pauses it after 60 quiet days, nothing
  breaks.
- Build-time data (S1): one CI step fetches GitHub activity and the YouTube feed into the
  git-ignored `src/generated/` with the read-only token; the Astro action builds with that data
  (D57). Pull requests run the checks and the build without deploying. The latest-video card
  shows the channel's thumbnail and the title of the newest video whose title passes the §15
  and family filters (D54).
- Knowledge pack for live /ask: built with the site as `/ask/knowledge.json` (published page text
  + the Q&A library, ≤ 20k tokens); the Worker fetches and caches it.
- MediaPipe WASM files from `node_modules/@mediapipe/tasks-vision/wasm` and the
  `hand_landmarker.task` model, self-hosted in `public/mediapipe/`.

## 10. AI cost and limits (live mode only)

- Without the Worker, the site costs nothing to run.
- With the Worker: the Anthropic credits included with Max 20x ($200/month, API only, expiring each
  billing cycle) in a dedicated Console workspace with a $180 monthly limit, auto-reload off and
  no purchased credits, so usage simply stops when credits run out. Model `claude-haiku-5-5`
  ($0.10 / $0.50 per MTok input/output up to 100k-token prompts; cache hits $0.01/MTok). Rough
  cost: an /ask answer well under $0.01; a full /life run under $0.01.
- Limits: /ask 8 per 10 min and 40 per day per IP; /interests 3 per day; /lesson 6 per day;
  /fit 5 per day; global daily caps; Turnstile on all. When any limit or the credits run out, the
  site falls back to its static modes (D25).

## 11. Privacy and ethics

- Public repository: nothing private in files or history (D39); `npm run check:privacy` in every
  session and in CI. Personal items are Jimmy's call (D51); research-ethics items stay.
- Analytics: none, or a cookieless beacon (Cloudflare Web Analytics works on any site) if Jimmy
  wants numbers later.
- Camera frames never leave the device. Visitor text is never stored or logged anywhere (D09). In
  "your own AI" mode the visitor's records never reach this site at all.
- Consent card and 18+ notice on /life before any text box. Photos: D31.
- `/privacy` explains all of this in plain language, and, once the Worker is on, Anthropic's API
  data terms quoted from Anthropic's current official pages.
- The easter-egg ideas state their ethics up front: IRB and parental permission for children;
  all-party consent for recordings.

## 12. Discoverability

Per-page titles and descriptions, canonical URLs on https://nanjierao.github.io, sitemap,
robots.txt, OG images, JSON-LD `Person` (sameAs Google Scholar, github.com/JimmyRaoUF, the YouTube
channel and the Zhihu profile) and
`ScholarlyArticle`. After launch Jimmy puts https://nanjierao.github.io in Google Scholar's
homepage field, his email signature, CV header, LinkedIn, and his GitHub profile. A custom domain
can be added later; GitHub then redirects the github.io address to it.

## 13. CISE page

Run the redirect once the real homepage (S3) is live, while the CISE account still exists: one SSH
session using `migration/cise/HOWTO.md` (301 redirects to https://nanjierao.github.io + a fallback
index.html). Ask CISE IT how long the page survives after graduation.

## 14. Phases and timeline (2026)

| When | Session | Outcome |
|---|---|---|
| Oct 27–28 | Setup in the browser | Organization, public repository, kit uploaded, Pages set to GitHub Actions |
| Oct 28–30 | S1 | v0 live: classic pages, intro strip, blog skeleton, GitHub activity |
| Oct 31 – Nov 6 | S2 → S3, and S4 | Design picked; real homepage and easter egg; DTRUE talk page, demo explainer, QR |
| by Nov 12 | S4 final | QR on the DTRUE slides |
| Nov 7–25 | S5, S6, S7 | Ask (static), Hands, Life & You (sample people + your own AI) |
| any time after S7 | S8 (optional) | Live AI through the Worker |
| late Nov | S9 | Audit |
| Jan 2027 | S10 | /zh pages |

Jimmy's time: about 30–60 minutes per session, reading the pull request and its screenshots and
answering TODOs, plus content only he can supply (CV PDF, photos, hand recordings, reflection
approvals). Blog posts take a few minutes each with `/post-zhihu`.

## 15. Budget

$0. Optional later: the Worker on Cloudflare's free plan with the Max 20x API credits (capped at
$180/month); a custom domain at about $10–11/year if he ever wants one.

## 16. Only Jimmy can do

Before S1 (in the browser; steps in SESSION_PROMPTS "Setup in the browser")
1. Create the free GitHub organization `nanjierao`.
2. Create the public repository `nanjierao.github.io` in it and upload the kit's contents.
3. Settings → Pages → Source: GitHub Actions.
4. claude.ai/code: install the Claude GitHub App for this repository and start S1.

While S1 is open
5. Make a public CV PDF (no phone number or home address; Study 1's name-only figure as 29%) and
   upload it to `inbox/`.
6. Pick the headline (facts.md §3), the status line (§2), the public email (§1), and whether to
   link LinkedIn and ORCID (§13). Check the DTRUE author list (§5.3, VERIFY).

Later
7. S2: pick a design. After S3: run the CISE redirect (`migration/cise/HOWTO.md`).
8. S4: put the QR code on the DTRUE slides.
9. S6: record the three hand stories with `/hands/record` and upload them to `inbox/`. S7: mark
   reflections ready; approve the sample people.
10. S8 (optional): create a free Cloudflare account; a Console workspace with a $180 monthly limit
    and auto-reload off; an API key that he pastes only into the Cloudflare dashboard as the
    Worker's secret; a Turnstile widget for nanjierao.github.io.
11. Whenever he writes on Zhihu: paste the draft (or upload it to `inbox/`) and run
    `/post-zhihu <zhihu url>`.

## 17. Open decisions for Jimmy

Headline (facts.md §3) and bio; status line (§2); public email (§1); umbrella line (D45); working
papers and the 2019 Chinese paper (D28); reflections (D12, D34); design direction (S2); optional
touches (D36); statement PDFs on /cv; whether and when to switch on live AI (S8).
